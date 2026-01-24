-- Create vendor_item_mappings table for remembering bill import mappings
CREATE TABLE public.vendor_item_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE CASCADE,
  vendor_item_name text NOT NULL,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  quantity_multiplier numeric NOT NULL DEFAULT 1,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_used_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(vendor_id, vendor_item_name)
);

-- Enable RLS
ALTER TABLE public.vendor_item_mappings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view vendor item mappings"
  ON public.vendor_item_mappings FOR SELECT
  USING (can_read('payments'));

CREATE POLICY "Users can create vendor item mappings"
  ON public.vendor_item_mappings FOR INSERT
  WITH CHECK (can_write('payments'));

CREATE POLICY "Users can update vendor item mappings"
  ON public.vendor_item_mappings FOR UPDATE
  USING (can_write('payments'));

CREATE POLICY "Users can delete vendor item mappings"
  ON public.vendor_item_mappings FOR DELETE
  USING (can_write('payments'));

-- Create index for faster lookups
CREATE INDEX idx_vendor_item_mappings_lookup 
  ON public.vendor_item_mappings(vendor_id, vendor_item_name);

CREATE INDEX idx_vendor_item_mappings_item 
  ON public.vendor_item_mappings(item_id);