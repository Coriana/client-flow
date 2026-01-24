-- Add job_asset_id to invoice_lines to track which asset rentals have been invoiced
ALTER TABLE public.invoice_lines 
ADD COLUMN job_asset_id uuid REFERENCES public.job_assets(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX idx_invoice_lines_job_asset_id ON public.invoice_lines(job_asset_id);