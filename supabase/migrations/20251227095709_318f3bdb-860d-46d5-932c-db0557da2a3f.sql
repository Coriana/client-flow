-- Add rental fields to assets table
ALTER TABLE public.assets
ADD COLUMN is_rental boolean DEFAULT false,
ADD COLUMN monthly_rate numeric DEFAULT NULL,
ADD COLUMN rental_start_date date DEFAULT NULL,
ADD COLUMN rented_to_client_id uuid REFERENCES public.clients(id) DEFAULT NULL,
ADD COLUMN next_invoice_date date DEFAULT NULL;

-- Create index for finding assets due for invoicing
CREATE INDEX idx_assets_rental_invoice ON public.assets(is_rental, next_invoice_date) WHERE is_rental = true;