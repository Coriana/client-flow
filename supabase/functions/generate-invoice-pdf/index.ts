import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authentication check - require valid user session
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token to verify authentication
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    
    if (authError || !user) {
      console.error("Authentication failed:", authError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has read access to invoices using RLS function
    const { data: hasAccess, error: permError } = await userClient.rpc('can_read', { _resource_name: 'invoices' });
    
    if (permError || !hasAccess) {
      console.error("Permission denied for user:", user.id, permError?.message);
      return new Response(
        JSON.stringify({ error: 'Forbidden - No access to invoices' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("User authenticated:", user.id);

    const { invoiceId } = await req.json();

    if (!invoiceId) {
      throw new Error("Invoice ID is required");
    }

    // Use service role for data fetching after authentication is verified
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Generating PDF for invoice:", invoiceId);

    // Fetch invoice with client and job (for trading name)
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*, clients(*), jobs(trading_name_id)")
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error("Invoice not found");
    }

    // Fetch invoice lines
    const { data: lines } = await supabase
      .from("invoice_lines")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("sort_order");

    // Fetch company settings
    const { data: company } = await supabase
      .from("company_settings")
      .select("*")
      .limit(1)
      .single();

    // Fetch trading name if job has one
    let tradingName = null;
    if (invoice.jobs?.trading_name_id) {
      const { data: tn } = await supabase
        .from("trading_names")
        .select("*")
        .eq("id", invoice.jobs.trading_name_id)
        .single();
      tradingName = tn;
    }

    // Calculate client credit (overpayments from other invoices)
    let clientCredit = 0;
    if (invoice.client_id) {
      const { data: clientInvoices } = await supabase
        .from("invoices")
        .select("id, total, amount_paid, status")
        .eq("client_id", invoice.client_id)
        .neq("id", invoiceId) // Exclude current invoice
        .in("status", ["paid", "partially_paid", "sent", "overdue"]);
      
      if (clientInvoices) {
        clientCredit = clientInvoices.reduce((sum: number, inv: any) => {
          const overpayment = (inv.amount_paid || 0) - (inv.total || 0);
          return sum + (overpayment > 0 ? overpayment : 0);
        }, 0);
      }
      console.log("Client credit calculated:", clientCredit);
    }

    const formatCurrency = (amount: number) =>
      new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(amount);

    const formatDate = (date: string) =>
      new Date(date).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

    // Determine company display name
    let companyDisplayName = company?.name || "Company Name";
    if (tradingName?.name) {
      companyDisplayName = `${company?.name || "Company"} trading as ${tradingName.name}`;
    } else if (company?.trading_name) {
      companyDisplayName = `${company.name} trading as ${company.trading_name}`;
    }

    // Build payment details HTML
    let paymentDetailsHtml = '';
    if (tradingName) {
      const paymentParts = [];
      
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
        paymentParts.push(`<div style="margin-bottom: 8px;"><strong>Other:</strong><br>${tradingName.other_payment_details.replace(/\n/g, '<br>')}</div>`);
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

    // Generate HTML for PDF
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
    .meta-section { }
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
          ${company?.address || ""}<br>
          ${company?.email ? `Email: ${company.email}` : ""}<br>
          ${company?.phone ? `Phone: ${company.phone}` : ""}<br>
          ${company?.abn ? `ABN: ${company.abn}` : ""}
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
        <div class="client-name">${invoice.clients?.name || "Client"}</div>
        <div class="client-address">${invoice.clients?.billing_address || ""}</div>
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
        <div class="status status-${invoice.status}">${invoice.status.replace("_", " ")}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 50%">Description</th>
          <th>Qty</th>
          <th>Unit Price</th>
          <th>Tax</th>
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
          .join("")}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-table">
        <div class="totals-row">
          <span>Subtotal</span>
          <span>${formatCurrency(invoice.subtotal)}</span>
        </div>
        <div class="totals-row">
          <span>Tax</span>
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
            : ""
        }
        ${
          invoice.amount_paid > 0
            ? `
        <div class="totals-row">
          <span>Amount Paid</span>
          <span>${formatCurrency(invoice.amount_paid)}</span>
        </div>
        `
            : ""
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
          : ""
      }
      ${
        invoice.terms
          ? `
        <div class="notes-label" style="margin-top: 16px;">Terms</div>
        <div>${invoice.terms}</div>
      `
          : ""
      }
    </div>
    `
        : ""
    }
  </div>
</body>
</html>
    `;

    return new Response(
      JSON.stringify({ html, invoice: invoice.invoice_number }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error generating invoice PDF:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
