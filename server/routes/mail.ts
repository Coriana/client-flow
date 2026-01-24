import { Router, Response } from 'express';
import { queryOne } from '../db/database.js';
import { authMiddleware, AuthRequest, requirePermission } from '../middleware/auth.js';
import { sendInvoiceEmail, sendInviteEmail } from '../utils/email.js';

const router = Router();

// Send invoice via email
router.post('/send-invoice', authMiddleware, async (req: AuthRequest, res: Response) => {
  const requireRead = requirePermission('invoices', 'read');
  await requireRead(req, res, async () => {
    const { invoiceId, recipientEmail } = req.body;

    if (!invoiceId) {
      res.status(400).json({ error: 'Invoice ID is required' });
      return;
    }

    if (!recipientEmail) {
      res.status(400).json({ error: 'Recipient email is required' });
      return;
    }

    // Get invoice
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

    const lines = queryOne<any>(
      'SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY sort_order',
      [invoiceId]
    ).data || [];
    const company = queryOne<any>('SELECT * FROM company_settings LIMIT 1').data || {};

    let companyDisplayName = company?.name || 'Company Name';
    if (tradingName?.name) {
      companyDisplayName = `${company?.name || 'Company'} trading as ${tradingName.name}`;
    } else if (company?.trading_name) {
      companyDisplayName = `${company.name} trading as ${company.trading_name}`;
    }

    const formatCurrency = (amount: number) =>
      new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);

    const formatDate = (date: string) =>
      new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

    // Generate invoice HTML
    const invoiceHtml = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; font-size: 14px; line-height: 1.5; padding: 20px; max-width: 800px; margin: 0 auto;">
  <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
    <div>
      <div style="font-size: 18px; font-weight: 700;">${companyDisplayName}</div>
      <div style="font-size: 12px; color: #666; margin-top: 8px;">
        ${company?.address || ''}<br>
        ${company?.email ? `Email: ${company.email}` : ''}<br>
        ${company?.phone ? `Phone: ${company.phone}` : ''}<br>
        ${company?.abn ? `ABN: ${company.abn}` : ''}
      </div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 32px; font-weight: 700; color: #1a1a1a;">INVOICE</div>
      <div style="font-size: 14px; color: #666; margin-top: 4px;">${invoice.invoice_number}</div>
    </div>
  </div>

  <div style="display: flex; justify-content: space-between; margin-bottom: 40px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
    <div>
      <div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Bill To</div>
      <div style="font-weight: 600;">${client?.name || 'Client'}</div>
      <div style="color: #666; white-space: pre-line;">${client?.billing_address || ''}</div>
    </div>
    <div>
      <div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Issue Date</div>
      <div style="font-weight: 600;">${formatDate(invoice.issue_date)}</div>
    </div>
    <div>
      <div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Due Date</div>
      <div style="font-weight: 600;">${formatDate(invoice.due_date)}</div>
    </div>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
    <thead>
      <tr>
        <th style="text-align: left; padding: 12px; border-bottom: 2px solid #1a1a1a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; width: 50%;">Description</th>
        <th style="text-align: left; padding: 12px; border-bottom: 2px solid #1a1a1a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Qty</th>
        <th style="text-align: left; padding: 12px; border-bottom: 2px solid #1a1a1a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Unit Price</th>
        <th style="text-align: left; padding: 12px; border-bottom: 2px solid #1a1a1a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Tax</th>
        <th style="text-align: right; padding: 12px; border-bottom: 2px solid #1a1a1a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${Array.isArray(lines)
        ? lines
            .map(
              (line: any) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">${line.description}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">${line.quantity}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">${formatCurrency(line.unit_price)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">${line.tax_rate || 0}%</td>
          <td style="text-align: right; padding: 12px; border-bottom: 1px solid #eee;">${formatCurrency(line.line_total)}</td>
        </tr>
      `
            )
            .join('')
        : ''}
    </tbody>
  </table>

  <div style="display: flex; justify-content: flex-end;">
    <div style="width: 280px;">
      <div style="display: flex; justify-content: space-between; padding: 8px 0;">
        <span>Subtotal</span>
        <span>${formatCurrency(invoice.subtotal)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 8px 0;">
        <span>Tax</span>
        <span>${formatCurrency(invoice.tax_total)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; border-top: 2px solid #1a1a1a; font-size: 18px; font-weight: 700; margin-top: 8px; padding-top: 16px;">
        <span>Total</span>
        <span>${formatCurrency(invoice.total)}</span>
      </div>
      ${
        invoice.amount_paid > 0
          ? `
      <div style="display: flex; justify-content: space-between; padding: 8px 0;">
        <span>Amount Paid</span>
        <span>${formatCurrency(invoice.amount_paid)}</span>
      </div>
      `
          : ''
      }
      <div style="display: flex; justify-content: space-between; font-weight: 600; padding: 8px 0;">
        <span>Balance Due</span>
        <span>${formatCurrency(Math.max(0, invoice.total - (invoice.amount_paid || 0)))}</span>
      </div>
    </div>
  </div>

  ${
    invoice.notes
      ? `
  <div style="margin-top: 40px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
    <div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Notes</div>
    <div>${invoice.notes}</div>
  </div>
  `
      : ''
  }
</div>
    `;

    // Send email
    const result = await sendInvoiceEmail(
      recipientEmail,
      invoice.invoice_number,
      invoiceHtml,
      companyDisplayName
    );

    if (!result.success) {
      res.status(500).json({ error: result.error || 'Failed to send email' });
      return;
    }

    res.json({ success: true, message: `Invoice sent to ${recipientEmail}` });
  });
});

// Send team invite via email
router.post('/send-invite', authMiddleware, async (req: AuthRequest, res: Response) => {
  const requireWrite = requirePermission('team', 'write');
  await requireWrite(req, res, async () => {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const company = queryOne<any>('SELECT name FROM company_settings LIMIT 1').data;
    const companyName = company?.name || 'Client Flow';

    // Get inviter name
    const inviterName = req.user?.full_name || req.user?.email || 'Team Admin';

    // Build signup URL (use origin from request or env)
    const origin = process.env.APP_URL || 'http://localhost:8080';
    const signupUrl = `${origin}/signup`;

    const result = await sendInviteEmail(email, inviterName, companyName, signupUrl);

    if (!result.success) {
      res.status(500).json({ error: result.error || 'Failed to send email' });
      return;
    }

    res.json({ success: true, message: `Invitation sent to ${email}` });
  });
});

export default router;
