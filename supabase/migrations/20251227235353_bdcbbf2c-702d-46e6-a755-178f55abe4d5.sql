-- Add vendor_contacts table (similar to client_contacts)
CREATE TABLE public.vendor_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add credit_balance to vendors
ALTER TABLE public.vendors ADD COLUMN credit_balance NUMERIC DEFAULT 0;

-- Add vendor_id to issues table for linking issues to vendors
ALTER TABLE public.issues ADD COLUMN vendor_id UUID REFERENCES public.vendors(id);

-- Enable RLS on vendor_contacts
ALTER TABLE public.vendor_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies for vendor_contacts
CREATE POLICY "All can view vendor contacts"
  ON public.vendor_contacts FOR SELECT
  USING (true);

CREATE POLICY "Staff can manage vendor contacts"
  ON public.vendor_contacts FOR ALL
  USING (NOT has_role(auth.uid(), 'readonly'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_vendor_contacts_updated_at
  BEFORE UPDATE ON public.vendor_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();