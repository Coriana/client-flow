-- Add default_tax_rate_id and billable defaults to company_settings
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS default_tax_rate_id uuid REFERENCES public.tax_rates(id),
ADD COLUMN IF NOT EXISTS default_billable_time boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS default_billable_expenses boolean DEFAULT false;

-- Add tax_rate_id to invoice_lines (keep tax_rate for backwards compatibility)
ALTER TABLE public.invoice_lines 
ADD COLUMN IF NOT EXISTS tax_rate_id uuid REFERENCES public.tax_rates(id);

-- Update invoice_lines to store actual tax name for display
ALTER TABLE public.invoice_lines 
ADD COLUMN IF NOT EXISTS tax_name text;