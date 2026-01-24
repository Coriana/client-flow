-- Create item_price_history table to track price changes
CREATE TABLE public.item_price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  old_unit_cost NUMERIC,
  new_unit_cost NUMERIC,
  old_sales_price NUMERIC,
  new_sales_price NUMERIC,
  changed_by UUID,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reason TEXT
);

-- Enable RLS on price history
ALTER TABLE public.item_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All can view price history" ON public.item_price_history FOR SELECT USING (true);
CREATE POLICY "Staff can manage price history" ON public.item_price_history FOR ALL USING (NOT has_role(auth.uid(), 'readonly'::app_role));

-- Add image_url columns to items and assets
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create purchases table for recording payments/receipts with allocation
CREATE TABLE public.purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  vendor_id UUID REFERENCES public.vendors(id),
  vendor_name TEXT,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  tax_amount NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL,
  receipt_url TEXT,
  payment_method TEXT,
  reference TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on purchases
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All can view purchases" ON public.purchases FOR SELECT USING (true);
CREATE POLICY "Staff can manage purchases" ON public.purchases FOR ALL USING (NOT has_role(auth.uid(), 'readonly'::app_role));

-- Create purchase_allocations table to track how purchases are allocated
CREATE TABLE public.purchase_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  allocation_type TEXT NOT NULL CHECK (allocation_type IN ('job_expense', 'inventory_restock', 'general')),
  job_id UUID REFERENCES public.jobs(id),
  item_id UUID REFERENCES public.items(id),
  quantity INTEGER,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on purchase allocations
ALTER TABLE public.purchase_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All can view purchase allocations" ON public.purchase_allocations FOR SELECT USING (true);
CREATE POLICY "Staff can manage purchase allocations" ON public.purchase_allocations FOR ALL USING (NOT has_role(auth.uid(), 'readonly'::app_role));

-- Create asset_history table for comprehensive asset tracking
CREATE TABLE public.asset_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  description TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  related_entity_type TEXT,
  related_entity_id UUID,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on asset history
ALTER TABLE public.asset_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All can view asset history" ON public.asset_history FOR SELECT USING (true);
CREATE POLICY "Staff can manage asset history" ON public.asset_history FOR ALL USING (NOT has_role(auth.uid(), 'readonly'::app_role));

-- Create storage bucket for images
INSERT INTO storage.buckets (id, name, public) VALUES ('images', 'images', true);

-- Create policies for image uploads
CREATE POLICY "Anyone can view images" ON storage.objects FOR SELECT USING (bucket_id = 'images');
CREATE POLICY "Authenticated users can upload images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'images' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update their images" ON storage.objects FOR UPDATE USING (bucket_id = 'images' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete images" ON storage.objects FOR DELETE USING (bucket_id = 'images' AND auth.role() = 'authenticated');