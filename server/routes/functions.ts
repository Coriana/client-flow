import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute } from '../db/database.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/auth.js';
import { allocateInvoiceNumber, allocateJobNumber } from '../utils/numbering.js';
import { generateInvoicePdf, generateInvoicesPdf } from '../utils/invoicePdf.js';
import { todayLocalDate, formatLocalDate } from '../utils/dates.js';

const router = Router();

router.post('/generate-invoice-pdf', authMiddleware, async (req: AuthRequest, res: Response) => {
  const requireRead = requirePermission('invoices', 'read');
  await requireRead(req, res, async () => {
    const { invoiceId } = req.body;
    if (!invoiceId) {
      res.status(400).json({ error: 'Invoice ID is required' });
      return;
    }

    const invoiceResult = queryOne<{ invoice_number: string }>(
      'SELECT invoice_number FROM invoices WHERE id = ?',
      [invoiceId]
    );
    if (invoiceResult.error || !invoiceResult.data) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    try {
      const pdf = await generateInvoicePdf(invoiceId);
      if (!pdf) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }

      const filename = `${invoiceResult.data.invoice_number}.pdf`.replace(/["\\]/g, '');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdf);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to generate PDF' });
    }
  });
});

router.post('/generate-invoices-pdf', authMiddleware, async (req: AuthRequest, res: Response) => {
  const requireRead = requirePermission('invoices', 'read');
  await requireRead(req, res, async () => {
    const { invoiceIds } = req.body;
    if (
      !Array.isArray(invoiceIds) ||
      invoiceIds.length === 0 ||
      invoiceIds.length > 100 ||
      !invoiceIds.every(id => typeof id === 'string')
    ) {
      res.status(400).json({ error: 'invoiceIds must be a non-empty array of at most 100 invoice ids' });
      return;
    }

    try {
      const pdf = await generateInvoicesPdf(invoiceIds);
      if (!pdf) {
        res.status(404).json({ error: 'No matching invoices found' });
        return;
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoices-${todayLocalDate()}.pdf"`);
      res.send(pdf);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to generate PDF' });
    }
  });
});

router.post('/generate-job-invoices', authMiddleware, async (req: AuthRequest, res: Response) => {
  const requireWrite = requirePermission('invoices', 'write');
  await requireWrite(req, res, async () => {
    const today = new Date();
    const todayStr = todayLocalDate();

    const jobs = queryAll<any>(
      `SELECT * FROM jobs WHERE is_recurring = 1 AND status = 'active' AND client_id IS NOT NULL AND next_invoice_date IS NOT NULL`
    ).data || [];

    const jobAssets = queryAll<any>(
      `SELECT * FROM job_assets WHERE is_active = 1 AND next_invoice_date IS NOT NULL`
    ).data || [];

    const jobsDueByRecurring = jobs.filter(job => {
      const nextInvoice = new Date(job.next_invoice_date);
      const leadDays = job.invoice_lead_days || 7;
      const generateDate = new Date(nextInvoice);
      generateDate.setDate(generateDate.getDate() - leadDays);
      return generateDate <= today;
    });

    const jobAssetsDue = jobAssets.filter(asset => {
      const nextInvoice = new Date(asset.next_invoice_date);
      const leadDays = asset.invoice_lead_days || 7;
      const generateDate = new Date(nextInvoice);
      generateDate.setDate(generateDate.getDate() - leadDays);
      const rentalStart = new Date(asset.rental_start_date);
      const rentalEnd = asset.rental_end_date ? new Date(asset.rental_end_date) : null;
      if (rentalStart > today) return false;
      if (rentalEnd && rentalEnd < today) return false;
      return generateDate <= today;
    });

    const jobIdsFromAssets = new Set(jobAssetsDue.map(ja => ja.job_id));
    const jobIdsFromRecurring = new Set(jobsDueByRecurring.map(j => j.id));
    const allJobIds = new Set([...jobIdsFromAssets, ...jobIdsFromRecurring]);

    if (allJobIds.size === 0) {
      res.json({ message: 'No job invoices to generate', count: 0 });
      return;
    }

    const settings = queryOne<any>(
      'SELECT id, default_tax_rate, default_tax_rate_id, default_payment_terms FROM company_settings LIMIT 1'
    ).data;
    const defaultTerms = settings?.default_payment_terms || 30;
    const defaultTax = settings?.default_tax_rate_id
      ? queryOne<any>('SELECT id, name, rate FROM tax_rates WHERE id = ?', [settings.default_tax_rate_id]).data
      : null;
    const defaultTaxRate = defaultTax?.rate ?? settings?.default_tax_rate ?? 0;
    const defaultTaxRateId = defaultTax?.id || null;
    const defaultTaxName = defaultTax?.name || null;

    const existingLines = queryAll<any>('SELECT timesheet_id, expense_id FROM invoice_lines').data || [];
    const invoicedTimesheetIds = new Set(existingLines.filter(l => l.timesheet_id).map(l => l.timesheet_id));
    const invoicedExpenseIds = new Set(existingLines.filter(l => l.expense_id).map(l => l.expense_id));

    const jobDataMap = new Map<string, any>();
    jobsDueByRecurring.forEach(job => jobDataMap.set(job.id, job));
    jobAssetsDue.forEach(asset => {
      if (!jobDataMap.has(asset.job_id)) {
        const job = queryOne<any>('SELECT * FROM jobs WHERE id = ?', [asset.job_id]).data;
        if (job) jobDataMap.set(asset.job_id, job);
      }
    });

    const jobAssetsMap = new Map<string, any[]>();
    jobAssetsDue.forEach(asset => {
      if (!jobAssetsMap.has(asset.job_id)) jobAssetsMap.set(asset.job_id, []);
      jobAssetsMap.get(asset.job_id)!.push(asset);
    });

    const invoicesCreated: string[] = [];

    for (const jobId of allJobIds) {
      const job = jobDataMap.get(jobId);
      if (!job) continue;

      const client = queryOne<any>('SELECT * FROM clients WHERE id = ?', [job.client_id]).data;
      if (!client) continue;

      const invoiceNumber = allocateInvoiceNumber();
      const paymentTerms = client.payment_terms || defaultTerms;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + paymentTerms);

      const lineItems: any[] = [];
      let sortOrder = 0;

      if (jobIdsFromRecurring.has(jobId) && job.recurring_rate && job.recurring_rate > 0) {
        const lineSubtotal = job.recurring_rate;
        const lineTax = lineSubtotal * (defaultTaxRate / 100);
        lineItems.push({
          description: `Monthly service fee - ${job.name}`,
          quantity: 1,
          unit: 'month',
          unit_price: job.recurring_rate,
          tax_rate: defaultTaxRate,
          tax_rate_id: defaultTaxRateId,
          tax_name: defaultTaxName,
          line_total: lineSubtotal + lineTax,
          sort_order: sortOrder++,
        });
      }

      const assetsForJob = jobAssetsMap.get(jobId) || [];
      assetsForJob.forEach(asset => {
        const assetInfo = queryOne<any>('SELECT * FROM assets WHERE id = ?', [asset.asset_id]).data;
        if (!assetInfo) return;
        
        // Determine billing period based on billing_in_advance flag
        const periodStart = new Date(asset.next_invoice_date);
        if (!asset.billing_in_advance) {
          // Arrears billing: bill for previous period
          periodStart.setMonth(periodStart.getMonth() - 1);
        }
        // Advance billing: bill for the current period (use next_invoice_date month as-is)
        const periodStr = periodStart.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });

        const lineSubtotal = asset.rental_rate;
        const lineTax = lineSubtotal * (defaultTaxRate / 100);
        lineItems.push({
          description: `Asset rental: ${assetInfo.name} (${assetInfo.asset_tag}) – ${periodStr}`,
          quantity: 1,
          unit: asset.billing_frequency || 'month',
          unit_price: asset.rental_rate,
          tax_rate: defaultTaxRate,
          tax_rate_id: defaultTaxRateId,
          tax_name: defaultTaxName,
          line_total: lineSubtotal + lineTax,
          sort_order: sortOrder++,
          job_asset_id: asset.id,
        });
      });

      const timesheets = queryAll<any>('SELECT * FROM timesheets WHERE job_id = ? AND is_billable = 1', [jobId]).data || [];
      timesheets.filter(ts => !invoicedTimesheetIds.has(ts.id)).forEach(ts => {
        const rate = ts.rate_override || job.hourly_rate || 0;
        const lineSubtotal = ts.hours * rate;
        const lineTax = lineSubtotal * (defaultTaxRate / 100);
        lineItems.push({
          description: `${ts.description || 'Time'} (${ts.date})`,
          quantity: ts.hours,
          unit: 'hours',
          unit_price: rate,
          tax_rate: defaultTaxRate,
          tax_rate_id: defaultTaxRateId,
          tax_name: defaultTaxName,
          line_total: lineSubtotal + lineTax,
          timesheet_id: ts.id,
          sort_order: sortOrder++,
        });
        invoicedTimesheetIds.add(ts.id);
      });

      const expenses = queryAll<any>('SELECT * FROM expenses WHERE job_id = ? AND is_billable = 1', [jobId]).data || [];
      expenses.filter(exp => !invoicedExpenseIds.has(exp.id)).forEach(exp => {
        const lineSubtotal = exp.amount;
        const lineTax = lineSubtotal * (defaultTaxRate / 100);
        lineItems.push({
          description: exp.description,
          quantity: 1,
          unit: 'each',
          unit_price: exp.amount,
          tax_rate: defaultTaxRate,
          tax_rate_id: defaultTaxRateId,
          tax_name: defaultTaxName,
          line_total: lineSubtotal + lineTax,
          expense_id: exp.id,
          sort_order: sortOrder++,
        });
        invoicedExpenseIds.add(exp.id);
      });

      if (lineItems.length === 0) continue;

      const subtotal = lineItems.reduce((sum, line) => {
        const lineSubtotal = line.quantity * line.unit_price;
        return sum + lineSubtotal;
      }, 0);
      const taxTotal = lineItems.reduce((sum, line) => {
        const lineSubtotal = line.quantity * line.unit_price;
        const lineTax = lineSubtotal * ((line.tax_rate || 0) / 100);
        return sum + lineTax;
      }, 0);
      const total = subtotal + taxTotal;

      const invoiceId = uuidv4();
      execute(
        `INSERT INTO invoices (id, invoice_number, client_id, job_id, issue_date, due_date, status, subtotal, tax_total, total, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceId,
          invoiceNumber,
          client.id,
          jobId,
          todayStr,
          formatLocalDate(dueDate),
          'draft',
          subtotal,
          taxTotal,
          total,
          `Invoice for ${job.name} (${job.job_number})`,
        ]
      );

      lineItems.forEach(line => {
        execute(
        `INSERT INTO invoice_lines (id, invoice_id, description, quantity, unit, unit_price, line_total, tax_rate, tax_rate_id, tax_name, sort_order, timesheet_id, expense_id, job_asset_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            invoiceId,
            line.description,
            line.quantity,
            line.unit,
            line.unit_price,
            line.line_total,
            line.tax_rate,
            line.tax_rate_id || null,
            line.tax_name || null,
            line.sort_order,
            line.timesheet_id || null,
            line.expense_id || null,
            line.job_asset_id || null,
          ]
        );
      });

      if (jobIdsFromRecurring.has(jobId) && job.next_invoice_date) {
        const nextInvoiceDate = new Date(job.next_invoice_date);
        nextInvoiceDate.setMonth(nextInvoiceDate.getMonth() + 1);
        execute('UPDATE jobs SET next_invoice_date = ? WHERE id = ?', [formatLocalDate(nextInvoiceDate), jobId]);
      }

      assetsForJob.forEach(asset => {
        const nextDate = new Date(asset.next_invoice_date);
        if (asset.billing_frequency === 'quarterly') {
          nextDate.setMonth(nextDate.getMonth() + 3);
        } else if (asset.billing_frequency === 'yearly') {
          nextDate.setFullYear(nextDate.getFullYear() + 1);
        } else {
          nextDate.setMonth(nextDate.getMonth() + 1);
        }
        execute('UPDATE job_assets SET next_invoice_date = ? WHERE id = ?', [formatLocalDate(nextDate), asset.id]);
      });

      invoicesCreated.push(invoiceNumber);
    }

    res.json({
      message: `Generated ${invoicesCreated.length} draft invoices`,
      count: invoicesCreated.length,
      invoices: invoicesCreated,
    });
  });
});

router.post('/allocate-invoice-number', authMiddleware, async (req: AuthRequest, res: Response) => {
  const requireWrite = requirePermission('invoices', 'write');
  await requireWrite(req, res, async () => {
    const invoice_number = allocateInvoiceNumber();
    res.json({ invoice_number });
  });
});

router.post('/allocate-job-number', authMiddleware, async (req: AuthRequest, res: Response) => {
  const requireWrite = requirePermission('jobs', 'write');
  await requireWrite(req, res, async () => {
    const job_number = allocateJobNumber();
    res.json({ job_number });
  });
});

export default router;
