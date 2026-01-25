import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute } from '../db/database.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/auth.js';

const router = Router();

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

router.post('/generate-invoice-pdf', authMiddleware, async (req: AuthRequest, res: Response) => {
  const requireRead = requirePermission('invoices', 'read');
  await requireRead(req, res, async () => {
    const { invoiceId } = req.body;
    if (!invoiceId) {
      res.status(400).json({ error: 'Invoice ID is required' });
      return;
    }

    const invoiceResult = queryOne<any>('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    if (invoiceResult.error || !invoiceResult.data) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const invoice = invoiceResult.data;
    const client = invoice.client_id
      ? queryOne<any>('SELECT * FROM clients WHERE id = ?', [invoice.client_id]).data
      : null;
    const job = invoice.job_id
      ? queryOne<any>('SELECT * FROM jobs WHERE id = ?', [invoice.job_id]).data
      : null;
    const tradingName = job?.trading_name_id
      ? queryOne<any>('SELECT * FROM trading_names WHERE id = ?', [job.trading_name_id]).data
      : null;

    const lines = queryAll<any>('SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY sort_order', [invoiceId]).data || [];
    const company = queryOne<any>('SELECT * FROM company_settings LIMIT 1').data || {};

    // Get the default tax name from tax_rates or use "GST" as fallback
    const defaultTaxRate = company?.default_tax_rate_id
      ? queryOne<any>('SELECT name FROM tax_rates WHERE id = ?', [company.default_tax_rate_id]).data
      : null;
    const taxDisplayName = lines[0]?.tax_name || defaultTaxRate?.name || 'GST';

    let clientCredit = 0;
    if (invoice.client_id) {
      const creditInvoices = queryAll<any>(
        `SELECT total, amount_paid, status FROM invoices
         WHERE client_id = ? AND id != ? AND status IN ('paid', 'partially_paid', 'sent', 'overdue')`,
        [invoice.client_id, invoiceId]
      ).data || [];

      clientCredit = creditInvoices.reduce((sum: number, inv: any) => {
        const overpayment = (inv.amount_paid || 0) - (inv.total || 0);
        return sum + (overpayment > 0 ? overpayment : 0);
      }, 0);
    }

    let companyDisplayName = company?.name || 'Company Name';
    if (tradingName?.name) {
      companyDisplayName = `${company?.name || 'Company'} trading as ${tradingName.name}`;
    } else if (company?.trading_name) {
      companyDisplayName = `${company.name} trading as ${company.trading_name}`;
    }

    // Use trading name ABN if available, otherwise fall back to company ABN
    const displayAbn = tradingName?.abn || company?.abn;

    let paymentDetailsHtml = '';
    if (tradingName) {
      const paymentParts: string[] = [];

      if (tradingName.bank_name || tradingName.bank_bsb || tradingName.bank_account_number) {
        let bankHtml = '<div style="margin-bottom: 8px;"><strong>Bank Transfer:</strong><br>';
        if (tradingName.bank_name) bankHtml += `Bank: ${tradingName.bank_name}<br>`;
        if (tradingName.bank_account_name) bankHtml += `Account Name: ${tradingName.bank_account_name}<br>`;
        if (tradingName.bank_bsb) bankHtml += `BSB: ${tradingName.bank_bsb}<br>`;
        if (tradingName.bank_account_number) bankHtml += `Account: ${tradingName.bank_account_number}`;
        bankHtml += '</div>';
        paymentParts.push(bankHtml);
      }

      if (tradingName.paypal_email) {
        paymentParts.push(`<div style="margin-bottom: 8px;"><strong>PayPal:</strong> ${tradingName.paypal_email}</div>`);
      }

      if (tradingName.other_payment_details) {
        paymentParts.push(
          `<div style="margin-bottom: 8px;"><strong>Other:</strong><br>${tradingName.other_payment_details.replace(/\n/g, '<br>')}</div>`
        );
      }

      if (paymentParts.length > 0) {
        paymentDetailsHtml = `
          <div class="notes" style="margin-top: 20px;">
            <div class="notes-label">Payment Details</div>
            ${paymentParts.join('')}
          </div>
        `;
      }
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; font-size: 14px; line-height: 1.5; padding: 40px; }
    .invoice { max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .company { font-size: 18px; font-weight: 700; }
    .company-details { font-size: 12px; color: #666; margin-top: 8px; }
    .invoice-title { font-size: 32px; font-weight: 700; color: #1a1a1a; text-align: right; }
    .invoice-number { font-size: 14px; color: #666; text-align: right; margin-top: 4px; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 40px; padding: 20px; background: #f8f9fa; border-radius: 8px; }
    .meta-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .meta-value { font-weight: 600; }
    .client-name { font-weight: 600; }
    .client-address { color: #666; white-space: pre-line; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    th { text-align: left; padding: 12px; border-bottom: 2px solid #1a1a1a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    th:last-child { text-align: right; }
    td { padding: 12px; border-bottom: 1px solid #eee; }
    td:last-child { text-align: right; }
    .totals { display: flex; justify-content: flex-end; }
    .totals-table { width: 280px; }
    .totals-row { display: flex; justify-content: space-between; padding: 8px 0; }
    .totals-row.total { border-top: 2px solid #1a1a1a; font-size: 18px; font-weight: 700; margin-top: 8px; padding-top: 16px; }
    .notes { margin-top: 40px; padding: 20px; background: #f8f9fa; border-radius: 8px; }
    .notes-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .status { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    .status-draft { background: #fef3cd; color: #856404; }
    .status-sent { background: #cce5ff; color: #004085; }
    .status-paid { background: #d4edda; color: #155724; }
    .status-overdue { background: #f8d7da; color: #721c24; }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div>
        <div class="company">${companyDisplayName}</div>
        <div class="company-details">
          ${company?.address || ''}<br>
          ${company?.email ? `Email: ${company.email}` : ''}<br>
          ${company?.phone ? `Phone: ${company.phone}` : ''}<br>
          ${displayAbn ? `ABN: ${displayAbn}` : ''}
        </div>
      </div>
      <div>
        <div class="invoice-title">INVOICE</div>
        <div class="invoice-number">${invoice.invoice_number}</div>
      </div>
    </div>

    <div class="meta">
      <div class="meta-section">
        <div class="meta-label">Bill To</div>
        <div class="client-name">${client?.name || 'Client'}</div>
        <div class="client-address">${client?.billing_address || ''}</div>
      </div>
      <div class="meta-section">
        <div class="meta-label">Issue Date</div>
        <div class="meta-value">${formatDate(invoice.issue_date)}</div>
      </div>
      <div class="meta-section">
        <div class="meta-label">Due Date</div>
        <div class="meta-value">${formatDate(invoice.due_date)}</div>
      </div>
      <div class="meta-section">
        <div class="meta-label">Status</div>
        <div class="status status-${invoice.status}">${invoice.status.replace('_', ' ')}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 50%">Description</th>
          <th>Qty</th>
          <th>Unit Price</th>
          <th>${taxDisplayName}</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${(lines || [])
          .map(
            (line: any) => `
          <tr>
            <td>${line.description}</td>
            <td>${line.quantity}</td>
            <td>${formatCurrency(line.unit_price)}</td>
            <td>${line.tax_rate}%</td>
            <td>${formatCurrency(line.line_total)}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-table">
        <div class="totals-row">
          <span>Subtotal</span>
          <span>${formatCurrency(invoice.subtotal)}</span>
        </div>
        <div class="totals-row">
          <span>${taxDisplayName}</span>
          <span>${formatCurrency(invoice.tax_total)}</span>
        </div>
        <div class="totals-row total">
          <span>Total</span>
          <span>${formatCurrency(invoice.total)}</span>
        </div>
        ${
          clientCredit > 0
            ? `
        <div class="totals-row" style="color: #28a745;">
          <span>Account Credit</span>
          <span>-${formatCurrency(clientCredit)}</span>
        </div>
        `
            : ''
        }
        ${
          invoice.amount_paid > 0
            ? `
        <div class="totals-row">
          <span>Amount Paid</span>
          <span>${formatCurrency(invoice.amount_paid)}</span>
        </div>
        `
            : ''
        }
        <div class="totals-row" style="font-weight: 600;">
          <span>Balance Due</span>
          <span>${formatCurrency(Math.max(0, invoice.total - (invoice.amount_paid || 0) - clientCredit))}</span>
        </div>
      </div>
    </div>

    ${paymentDetailsHtml}

    ${
      invoice.notes || invoice.terms
        ? `
    <div class="notes">
      ${
        invoice.notes
          ? `
        <div class="notes-label">Notes</div>
        <div>${invoice.notes}</div>
      `
          : ''
      }
      ${
        invoice.terms
          ? `
        <div class="notes-label" style="margin-top: 16px;">Terms</div>
        <div>${invoice.terms}</div>
      `
          : ''
      }
    </div>
    `
        : ''
    }
  </div>
</body>
</html>
    `;

    res.json({ html, invoice: invoice.invoice_number });
  });
});

router.post('/generate-job-invoices', authMiddleware, async (req: AuthRequest, res: Response) => {
  const requireWrite = requirePermission('invoices', 'write');
  await requireWrite(req, res, async () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

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
      'SELECT id, invoice_prefix, invoice_next_number, default_tax_rate, default_tax_rate_id, default_payment_terms FROM company_settings LIMIT 1'
    ).data;
    const prefix = settings?.invoice_prefix || 'INV';
    let nextNum = settings?.invoice_next_number || 1;
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

      const invoiceNumber = `${prefix}-${String(nextNum).padStart(5, '0')}`;
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
          dueDate.toISOString().split('T')[0],
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
        execute('UPDATE jobs SET next_invoice_date = ? WHERE id = ?', [nextInvoiceDate.toISOString().split('T')[0], jobId]);
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
        execute('UPDATE job_assets SET next_invoice_date = ? WHERE id = ?', [nextDate.toISOString().split('T')[0], asset.id]);
      });

      invoicesCreated.push(invoiceNumber);
      nextNum++;
    }

    if (invoicesCreated.length > 0 && settings) {
      execute('UPDATE company_settings SET invoice_next_number = ? WHERE id = ?', [nextNum, settings.id]);
    }

    res.json({
      message: `Generated ${invoicesCreated.length} draft invoices`,
      count: invoicesCreated.length,
      invoices: invoicesCreated,
    });
  });
});

export default router;
