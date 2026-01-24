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

    // Verify user has write access to invoices (creating invoices requires write permission)
    const { data: hasAccess, error: permError } = await userClient.rpc('can_write', { _resource_name: 'invoices' });
    
    if (permError || !hasAccess) {
      console.error("Permission denied for user:", user.id, permError?.message);
      return new Response(
        JSON.stringify({ error: 'Forbidden - No write access to invoices' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("User authenticated:", user.id);

    // Use service role for data operations after authentication is verified
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting job invoice generation...");

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Find recurring jobs that need invoicing (where next_invoice_date - lead_days <= today)
    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select(`
        *,
        clients!jobs_client_id_fkey(id, name, payment_terms)
      `)
      .eq("is_recurring", true)
      .eq("status", "active")
      .not("client_id", "is", null)
      .not("next_invoice_date", "is", null);

    if (jobsError) {
      console.error("Error fetching jobs:", jobsError);
      throw jobsError;
    }

    // Filter jobs where we should generate invoice based on lead days
    const jobsDueByRecurring = (jobs || []).filter(job => {
      const nextInvoice = new Date(job.next_invoice_date);
      const leadDays = job.invoice_lead_days || 7;
      const generateDate = new Date(nextInvoice);
      generateDate.setDate(generateDate.getDate() - leadDays);
      return generateDate <= today;
    });

    // Also find jobs with job_assets due for invoicing
    const { data: jobAssetsData, error: jobAssetsError } = await supabase
      .from("job_assets")
      .select(`
        *,
        jobs!job_assets_job_id_fkey(
          id, job_number, name, client_id, hourly_rate, status,
          clients!jobs_client_id_fkey(id, name, payment_terms)
        ),
        assets!job_assets_asset_id_fkey(id, name, asset_tag)
      `)
      .eq("is_active", true)
      .not("next_invoice_date", "is", null);

    if (jobAssetsError) {
      console.error("Error fetching job_assets:", jobAssetsError);
      throw jobAssetsError;
    }

    // Filter job_assets that are due
    const jobAssetsDue = (jobAssetsData || []).filter(ja => {
      const nextInvoice = new Date(ja.next_invoice_date);
      const leadDays = ja.invoice_lead_days || 7;
      const generateDate = new Date(nextInvoice);
      generateDate.setDate(generateDate.getDate() - leadDays);
      // Also check rental period is active
      const rentalStart = new Date(ja.rental_start_date);
      const rentalEnd = ja.rental_end_date ? new Date(ja.rental_end_date) : null;
      if (rentalStart > today) return false;
      if (rentalEnd && rentalEnd < today) return false;
      return generateDate <= today && ja.jobs?.status === 'active';
    });

    // Collect unique job IDs that need invoices
    const jobIdsFromAssets = new Set(jobAssetsDue.map(ja => ja.job_id));
    const jobIdsFromRecurring = new Set(jobsDueByRecurring.map(j => j.id));
    const allJobIds = new Set([...jobIdsFromAssets, ...jobIdsFromRecurring]);

    console.log(`Found ${allJobIds.size} jobs due for invoicing (${jobsDueByRecurring.length} recurring, ${jobIdsFromAssets.size} with assets)`);

    if (allJobIds.size === 0) {
      return new Response(
        JSON.stringify({ message: "No job invoices to generate", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get company settings
    const { data: settings } = await supabase
      .from("company_settings")
      .select("id, invoice_prefix, invoice_next_number, default_tax_rate, default_payment_terms")
      .limit(1)
      .single();

    const prefix = settings?.invoice_prefix || "INV";
    let nextNum = settings?.invoice_next_number || 1;
    const defaultTaxRate = settings?.default_tax_rate || 10;
    const defaultTerms = settings?.default_payment_terms || 30;

    // Get already invoiced timesheet/expense IDs
    const { data: existingLines } = await supabase
      .from("invoice_lines")
      .select("timesheet_id, expense_id");
    
    const invoicedTimesheetIds = new Set((existingLines || []).filter(l => l.timesheet_id).map(l => l.timesheet_id));
    const invoicedExpenseIds = new Set((existingLines || []).filter(l => l.expense_id).map(l => l.expense_id));

    const invoicesCreated: string[] = [];

    // Build a map of job data for jobs with assets
    const jobDataMap = new Map<string, any>();
    for (const ja of jobAssetsDue) {
      if (ja.jobs) {
        jobDataMap.set(ja.job_id, ja.jobs);
      }
    }
    // Add recurring jobs to map
    for (const job of jobsDueByRecurring) {
      jobDataMap.set(job.id, job);
    }

    // Group job_assets by job_id
    const jobAssetsMap = new Map<string, any[]>();
    for (const ja of jobAssetsDue) {
      if (!jobAssetsMap.has(ja.job_id)) {
        jobAssetsMap.set(ja.job_id, []);
      }
      jobAssetsMap.get(ja.job_id)!.push(ja);
    }

    for (const jobId of allJobIds) {
      const job = jobDataMap.get(jobId);
      if (!job) continue;
      
      const client = job.clients;
      if (!client) continue;

      const invoiceNumber = `${prefix}-${String(nextNum).padStart(5, "0")}`;
      const paymentTerms = client.payment_terms || defaultTerms;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + paymentTerms);

      console.log(`Processing job ${job.job_number} (${job.name})`);

      // Calculate line items
      const lineItems: any[] = [];
      let sortOrder = 0;

      // Add recurring service rate (if applicable and this job is in recurring list)
      if (jobIdsFromRecurring.has(jobId) && job.recurring_rate && job.recurring_rate > 0) {
        const lineTotal = job.recurring_rate;
        lineItems.push({
          description: `Monthly service fee - ${job.name}`,
          quantity: 1,
          unit: "month",
          unit_price: job.recurring_rate,
          tax_rate: defaultTaxRate,
          line_total: lineTotal,
          sort_order: sortOrder++,
        });
      }

      // Add job_assets rental lines
      const assetsForJob = jobAssetsMap.get(jobId) || [];
      for (const ja of assetsForJob) {
        const asset = ja.assets;
        if (!asset) continue;

        // Determine billing period description
        const billingPeriodStart = new Date(ja.next_invoice_date);
        billingPeriodStart.setMonth(billingPeriodStart.getMonth() - 1);
        const billingPeriodEnd = new Date(ja.next_invoice_date);
        billingPeriodEnd.setDate(billingPeriodEnd.getDate() - 1);
        
        const periodStr = `${billingPeriodStart.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}`;

        lineItems.push({
          description: `Asset rental: ${asset.name} (${asset.asset_tag}) – ${periodStr}`,
          quantity: 1,
          unit: ja.billing_frequency || "month",
          unit_price: ja.rental_rate,
          tax_rate: defaultTaxRate,
          line_total: ja.rental_rate,
          sort_order: sortOrder++,
        });
      }

      // Get unbilled timesheets for this job
      const { data: timesheets } = await supabase
        .from("timesheets")
        .select("*")
        .eq("job_id", jobId)
        .eq("is_billable", true);
      
      const unbilledTimesheets = (timesheets || []).filter(ts => !invoicedTimesheetIds.has(ts.id));

      // Get unbilled expenses for this job
      const { data: expenses } = await supabase
        .from("expenses")
        .select("*")
        .eq("job_id", jobId)
        .eq("is_billable", true);
      
      const unbilledExpenses = (expenses || []).filter(exp => !invoicedExpenseIds.has(exp.id));

      // Add time entries
      for (const ts of unbilledTimesheets) {
        const rate = ts.rate_override || job.hourly_rate || 0;
        const lineTotal = ts.hours * rate;
        lineItems.push({
          description: `${ts.description || 'Time'} (${ts.date})`,
          quantity: ts.hours,
          unit: "hours",
          unit_price: rate,
          tax_rate: defaultTaxRate,
          line_total: lineTotal,
          timesheet_id: ts.id,
          sort_order: sortOrder++,
        });
        invoicedTimesheetIds.add(ts.id);
      }

      // Add expenses
      for (const exp of unbilledExpenses) {
        lineItems.push({
          description: exp.description,
          quantity: 1,
          unit: "each",
          unit_price: exp.amount,
          tax_rate: defaultTaxRate,
          line_total: exp.amount,
          expense_id: exp.id,
          sort_order: sortOrder++,
        });
        invoicedExpenseIds.add(exp.id);
      }

      // Skip if no line items
      if (lineItems.length === 0) {
        console.log(`No billable items for job ${job.job_number}, skipping`);
        continue;
      }

      // Calculate totals
      const subtotal = lineItems.reduce((sum, line) => sum + line.line_total, 0);
      const taxTotal = subtotal * (defaultTaxRate / 100);
      const total = subtotal + taxTotal;

      console.log(`Creating invoice ${invoiceNumber} with ${lineItems.length} lines, total: ${total}`);

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          invoice_number: invoiceNumber,
          client_id: client.id,
          job_id: jobId,
          issue_date: todayStr,
          due_date: dueDate.toISOString().split("T")[0],
          status: "draft",
          subtotal,
          tax_total: taxTotal,
          total,
          notes: `Invoice for ${job.name} (${job.job_number})`,
        })
        .select()
        .single();

      if (invoiceError) {
        console.error(`Error creating invoice for job ${jobId}:`, invoiceError);
        continue;
      }

      // Create invoice lines
      const linesWithInvoiceId = lineItems.map(line => ({
        ...line,
        invoice_id: invoice.id,
      }));

      await supabase.from("invoice_lines").insert(linesWithInvoiceId);

      // Update job's next invoice date (if recurring)
      if (jobIdsFromRecurring.has(jobId) && job.next_invoice_date) {
        const nextInvoiceDate = new Date(job.next_invoice_date);
        nextInvoiceDate.setMonth(nextInvoiceDate.getMonth() + 1);

        await supabase
          .from("jobs")
          .update({ next_invoice_date: nextInvoiceDate.toISOString().split("T")[0] })
          .eq("id", jobId);
      }

      // Update job_assets next_invoice_date
      for (const ja of assetsForJob) {
        const nextDate = new Date(ja.next_invoice_date);
        if (ja.billing_frequency === 'monthly') {
          nextDate.setMonth(nextDate.getMonth() + 1);
        } else if (ja.billing_frequency === 'quarterly') {
          nextDate.setMonth(nextDate.getMonth() + 3);
        } else if (ja.billing_frequency === 'yearly') {
          nextDate.setFullYear(nextDate.getFullYear() + 1);
        } else {
          nextDate.setMonth(nextDate.getMonth() + 1);
        }

        await supabase
          .from("job_assets")
          .update({ next_invoice_date: nextDate.toISOString().split("T")[0] })
          .eq("id", ja.id);
      }

      invoicesCreated.push(invoiceNumber);
      nextNum++;
    }

    // Update next invoice number in settings
    if (invoicesCreated.length > 0 && settings) {
      await supabase
        .from("company_settings")
        .update({ invoice_next_number: nextNum })
        .eq("id", settings.id);
    }

    console.log(`Created ${invoicesCreated.length} invoices:`, invoicesCreated);

    return new Response(
      JSON.stringify({
        message: `Generated ${invoicesCreated.length} draft invoices`,
        count: invoicesCreated.length,
        invoices: invoicesCreated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in generate-job-invoices:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
