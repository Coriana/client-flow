-- Add recurring billing fields to jobs table
ALTER TABLE public.jobs 
ADD COLUMN is_recurring boolean DEFAULT false,
ADD COLUMN billing_day integer DEFAULT 1,
ADD COLUMN recurring_rate numeric DEFAULT 0,
ADD COLUMN next_invoice_date date,
ADD COLUMN invoice_lead_days integer DEFAULT 7;

-- Add comment for clarity
COMMENT ON COLUMN public.jobs.is_recurring IS 'Whether this job has recurring monthly billing';
COMMENT ON COLUMN public.jobs.billing_day IS 'Day of month to generate invoice (1-28)';
COMMENT ON COLUMN public.jobs.recurring_rate IS 'Monthly recurring rate for job services';
COMMENT ON COLUMN public.jobs.next_invoice_date IS 'Next date to generate recurring invoice';
COMMENT ON COLUMN public.jobs.invoice_lead_days IS 'Days before billing date to generate invoice';