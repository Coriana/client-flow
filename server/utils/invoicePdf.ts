import PDFDocument from 'pdfkit';
import { queryAll, queryOne } from '../db/database.js';
import { formatDisplayDate } from './dates.js';

/**
 * Server-side invoice PDF rendering (pdfkit — pure JS, built-in standard
 * fonts, no headless browser). Replaces the old popup + window.print() flow.
 */

export interface InvoiceData {
  invoice: any;
  client: any | null;
  job: any | null;
  tradingName: any | null;
  lines: any[];
  company: any;
  taxDisplayName: string;
  clientCredit: number;
  companyDisplayName: string;
  displayAbn: string | null;
}

/** Gather everything needed to render one invoice. Returns null if the invoice doesn't exist. */
export function gatherInvoiceData(invoiceId: string): InvoiceData | null {
  const invoiceResult = queryOne<any>('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  if (invoiceResult.error || !invoiceResult.data) {
    return null;
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
  const displayAbn = tradingName?.abn || company?.abn || null;

  return {
    invoice,
    client,
    job,
    tradingName,
    lines,
    company,
    taxDisplayName,
    clientCredit,
    companyDisplayName,
    displayAbn,
  };
}

/**
 * Build an Intl.NumberFormat currency formatter from company_settings,
 * validating the same way the frontend BrandingContext does and falling
 * back to en-AU / AUD. Shared with the send-invoice email in mail.ts.
 */
export function makeCurrencyFormatter(company: any): (amount: number) => string {
  let currencyLocale = company?.currency_locale || 'en-AU';
  if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(currencyLocale)) {
    currencyLocale = 'en-AU';
  }

  let currency = company?.currency || 'AUD';
  if (!/^[A-Z]{3}$/.test(currency)) {
    currency = 'AUD';
  }

  let formatter: Intl.NumberFormat;
  try {
    formatter = new Intl.NumberFormat(currencyLocale, { style: 'currency', currency });
  } catch {
    formatter = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
  }
  return (amount: number) => formatter.format(amount || 0);
}

// ---------------------------------------------------------------------------
// Layout constants (A4, 50pt margins)
// ---------------------------------------------------------------------------
const MARGIN = 50;
const GRAY = '#666666';
const BLACK = '#1a1a1a';
const LIGHT_RULE = '#dddddd';

const FONT = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';

function humanizeStatus(status: string): string {
  return String(status || '')
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Ensure at least `needed` points of vertical space remain, else start a new page. */
function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) {
    doc.addPage();
  }
}

/** Draw one invoice into the given document at the current page. */
export function renderInvoice(doc: PDFKit.PDFDocument, data: InvoiceData): void {
  const { invoice, client, tradingName, lines, company, taxDisplayName, clientCredit, companyDisplayName, displayAbn } = data;
  const formatCurrency = makeCurrencyFormatter(company);
  const localeForDates = /^[a-z]{2}(-[A-Z]{2})?$/.test(company?.currency_locale || '')
    ? company.currency_locale
    : 'en-AU';

  const pageWidth = doc.page.width;
  const contentWidth = pageWidth - MARGIN * 2;
  const topY = doc.page.margins.top;

  // -------------------------------------------------------------------------
  // Header: company block (left) / INVOICE title + number (right)
  // -------------------------------------------------------------------------
  const headerLeftWidth = contentWidth * 0.6;
  doc.font(FONT_BOLD).fontSize(18).fillColor(BLACK);
  doc.text(companyDisplayName, MARGIN, topY, { width: headerLeftWidth });

  doc.font(FONT).fontSize(9).fillColor(GRAY);
  doc.moveDown(0.3);
  const companyDetails: string[] = [];
  if (company?.address) companyDetails.push(company.address);
  if (company?.email) companyDetails.push(`Email: ${company.email}`);
  if (company?.phone) companyDetails.push(`Phone: ${company.phone}`);
  if (displayAbn) companyDetails.push(`ABN: ${displayAbn}`);
  if (companyDetails.length > 0) {
    doc.text(companyDetails.join('\n'), MARGIN, doc.y, { width: headerLeftWidth });
  }
  const leftHeaderBottom = doc.y;

  const headerRightX = MARGIN + contentWidth * 0.6;
  const headerRightWidth = contentWidth * 0.4;
  doc.font(FONT_BOLD).fontSize(24).fillColor(BLACK);
  doc.text('INVOICE', headerRightX, topY, { width: headerRightWidth, align: 'right' });
  doc.font(FONT).fontSize(11).fillColor(GRAY);
  doc.text(String(invoice.invoice_number || ''), headerRightX, doc.y + 2, { width: headerRightWidth, align: 'right' });
  const rightHeaderBottom = doc.y;

  doc.y = Math.max(leftHeaderBottom, rightHeaderBottom) + 25;

  // -------------------------------------------------------------------------
  // Meta band: Bill To / Issue Date / Due Date / Status
  // -------------------------------------------------------------------------
  const metaY = doc.y;
  const billToWidth = contentWidth * 0.4;
  const metaColWidth = (contentWidth - billToWidth) / 3;

  const metaLabel = (label: string, x: number, width: number) => {
    doc.font(FONT).fontSize(8).fillColor(GRAY);
    doc.text(label.toUpperCase(), x, metaY, { width, characterSpacing: 0.5 });
  };

  metaLabel('Bill To', MARGIN, billToWidth);
  doc.font(FONT_BOLD).fontSize(10).fillColor(BLACK);
  doc.text(client?.name || 'Client', MARGIN, metaY + 12, { width: billToWidth - 10 });
  if (client?.billing_address) {
    doc.font(FONT).fontSize(9).fillColor(GRAY);
    doc.text(String(client.billing_address), MARGIN, doc.y + 2, { width: billToWidth - 10 });
  }
  const billToBottom = doc.y;

  const metaValue = (label: string, value: string, colIndex: number) => {
    const x = MARGIN + billToWidth + metaColWidth * colIndex;
    metaLabel(label, x, metaColWidth);
    doc.font(FONT_BOLD).fontSize(10).fillColor(BLACK);
    doc.text(value, x, metaY + 12, { width: metaColWidth - 6 });
    return doc.y;
  };

  const issueBottom = metaValue('Issue Date', invoice.issue_date ? formatDisplayDate(invoice.issue_date, localeForDates) : '-', 0);
  const dueBottom = metaValue('Due Date', invoice.due_date ? formatDisplayDate(invoice.due_date, localeForDates) : '-', 1);
  const statusBottom = metaValue('Status', humanizeStatus(invoice.status), 2);

  doc.y = Math.max(billToBottom, issueBottom, dueBottom, statusBottom) + 25;

  // -------------------------------------------------------------------------
  // Line-items table
  // -------------------------------------------------------------------------
  const colDesc = { x: MARGIN, width: contentWidth * 0.5 };
  const colQty = { x: MARGIN + contentWidth * 0.5, width: contentWidth * 0.1 };
  const colPrice = { x: MARGIN + contentWidth * 0.6, width: contentWidth * 0.15 };
  const colTax = { x: MARGIN + contentWidth * 0.75, width: contentWidth * 0.1 };
  const colTotal = { x: MARGIN + contentWidth * 0.85, width: contentWidth * 0.15 };
  const CELL_PAD = 6;

  const drawTableHeader = () => {
    const y = doc.y;
    doc.font(FONT_BOLD).fontSize(8).fillColor(BLACK);
    doc.text('DESCRIPTION', colDesc.x, y, { width: colDesc.width - CELL_PAD, characterSpacing: 0.5 });
    doc.text('QTY', colQty.x, y, { width: colQty.width - CELL_PAD, align: 'right', characterSpacing: 0.5 });
    doc.text('UNIT PRICE', colPrice.x, y, { width: colPrice.width - CELL_PAD, align: 'right', characterSpacing: 0.5 });
    doc.text(taxDisplayName.toUpperCase(), colTax.x, y, { width: colTax.width - CELL_PAD, align: 'right', characterSpacing: 0.5 });
    doc.text('TOTAL', colTotal.x, y, { width: colTotal.width, align: 'right', characterSpacing: 0.5 });
    const headerBottom = y + 12;
    doc.moveTo(MARGIN, headerBottom).lineTo(MARGIN + contentWidth, headerBottom).lineWidth(1).strokeColor(BLACK).stroke();
    doc.y = headerBottom + 8;
  };

  ensureSpace(doc, 60);
  drawTableHeader();

  doc.font(FONT).fontSize(9);
  for (const line of lines) {
    const description = String(line.description || '');
    const descHeight = doc.heightOfString(description, { width: colDesc.width - CELL_PAD });
    const rowHeight = Math.max(descHeight, 11) + 8;

    // Paginate: if this row won't fit, start a new page and repeat the header
    const bottom = doc.page.height - doc.page.margins.bottom;
    if (doc.y + rowHeight > bottom) {
      doc.addPage();
      drawTableHeader();
      doc.font(FONT).fontSize(9);
    }

    const rowY = doc.y;
    doc.fillColor(BLACK);
    doc.text(description, colDesc.x, rowY, { width: colDesc.width - CELL_PAD });
    doc.text(String(line.quantity ?? ''), colQty.x, rowY, { width: colQty.width - CELL_PAD, align: 'right' });
    doc.text(formatCurrency(line.unit_price), colPrice.x, rowY, { width: colPrice.width - CELL_PAD, align: 'right' });
    doc.text(`${line.tax_rate ?? 0}%`, colTax.x, rowY, { width: colTax.width - CELL_PAD, align: 'right' });
    doc.text(formatCurrency(line.line_total), colTotal.x, rowY, { width: colTotal.width, align: 'right' });

    const rowBottom = rowY + rowHeight;
    doc.moveTo(MARGIN, rowBottom).lineTo(MARGIN + contentWidth, rowBottom).lineWidth(0.5).strokeColor(LIGHT_RULE).stroke();
    doc.y = rowBottom + 8;
  }

  // -------------------------------------------------------------------------
  // Totals block (right-aligned)
  // -------------------------------------------------------------------------
  const totalsWidth = 220;
  const totalsX = MARGIN + contentWidth - totalsWidth;
  const totalsLabelWidth = totalsWidth * 0.55;
  const totalsValueWidth = totalsWidth * 0.45;

  const balanceDue = Math.max(0, (invoice.total || 0) - (invoice.amount_paid || 0) - clientCredit);
  const totalsRows: Array<{ label: string; value: string; bold?: boolean; ruleAbove?: boolean; color?: string }> = [
    { label: 'Subtotal', value: formatCurrency(invoice.subtotal) },
    { label: taxDisplayName, value: formatCurrency(invoice.tax_total) },
    { label: 'Total', value: formatCurrency(invoice.total), bold: true, ruleAbove: true },
  ];
  if (clientCredit > 0) {
    totalsRows.push({ label: 'Account Credit', value: `-${formatCurrency(clientCredit)}`, color: '#28a745' });
  }
  if ((invoice.amount_paid || 0) > 0) {
    totalsRows.push({ label: 'Amount Paid', value: formatCurrency(invoice.amount_paid) });
  }
  totalsRows.push({ label: 'Balance Due', value: formatCurrency(balanceDue), bold: true });

  ensureSpace(doc, totalsRows.length * 18 + 20);
  doc.y += 6;
  for (const row of totalsRows) {
    if (row.ruleAbove) {
      doc.moveTo(totalsX, doc.y).lineTo(totalsX + totalsWidth, doc.y).lineWidth(1).strokeColor(BLACK).stroke();
      doc.y += 6;
    }
    const rowY = doc.y;
    doc.font(row.bold ? FONT_BOLD : FONT).fontSize(row.bold ? 11 : 9).fillColor(row.color || BLACK);
    doc.text(row.label, totalsX, rowY, { width: totalsLabelWidth });
    doc.text(row.value, totalsX + totalsLabelWidth, rowY, { width: totalsValueWidth, align: 'right' });
    doc.y = rowY + (row.bold ? 18 : 15);
  }

  // -------------------------------------------------------------------------
  // Payment details (from trading name, if any)
  // -------------------------------------------------------------------------
  const paymentLines: string[] = [];
  if (tradingName) {
    if (tradingName.bank_name || tradingName.bank_bsb || tradingName.bank_account_number) {
      paymentLines.push('Bank Transfer:');
      if (tradingName.bank_name) paymentLines.push(`  Bank: ${tradingName.bank_name}`);
      if (tradingName.bank_account_name) paymentLines.push(`  Account Name: ${tradingName.bank_account_name}`);
      if (tradingName.bank_bsb) paymentLines.push(`  BSB: ${tradingName.bank_bsb}`);
      if (tradingName.bank_account_number) paymentLines.push(`  Account: ${tradingName.bank_account_number}`);
    }
    if (tradingName.paypal_email) {
      paymentLines.push(`PayPal: ${tradingName.paypal_email}`);
    }
    if (tradingName.other_payment_details) {
      paymentLines.push('Other:');
      paymentLines.push(String(tradingName.other_payment_details));
    }
  }

  const drawSection = (label: string, body: string) => {
    doc.font(FONT).fontSize(9);
    const bodyHeight = doc.heightOfString(body, { width: contentWidth });
    ensureSpace(doc, bodyHeight + 30);
    doc.y += 14;
    doc.font(FONT).fontSize(8).fillColor(GRAY);
    doc.text(label.toUpperCase(), MARGIN, doc.y, { width: contentWidth, characterSpacing: 0.5 });
    doc.font(FONT).fontSize(9).fillColor(BLACK);
    doc.text(body, MARGIN, doc.y + 3, { width: contentWidth });
  };

  if (paymentLines.length > 0) {
    drawSection('Payment Details', paymentLines.join('\n'));
  }
  if (invoice.notes) {
    drawSection('Notes', String(invoice.notes));
  }
  if (invoice.terms) {
    drawSection('Terms', String(invoice.terms));
  }
}

/** Collect a PDFDocument's output stream into a single Buffer. */
function collectPdf(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

function createDocument(): PDFKit.PDFDocument {
  return new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
}

/** Generate a single-invoice PDF. Returns null if the invoice doesn't exist. */
export async function generateInvoicePdf(invoiceId: string): Promise<Buffer | null> {
  const data = gatherInvoiceData(invoiceId);
  if (!data) return null;

  const doc = createDocument();
  renderInvoice(doc, data);
  return collectPdf(doc);
}

/**
 * Generate one combined PDF for multiple invoices — each invoice starts on
 * its own page. Unknown ids are skipped; returns null if none were found.
 */
export async function generateInvoicesPdf(invoiceIds: string[]): Promise<Buffer | null> {
  const found = invoiceIds
    .map(id => gatherInvoiceData(id))
    .filter((d): d is InvoiceData => d !== null);

  if (found.length === 0) return null;

  const doc = createDocument();
  found.forEach((data, index) => {
    if (index > 0) {
      doc.addPage();
    }
    renderInvoice(doc, data);
  });
  return collectPdf(doc);
}
