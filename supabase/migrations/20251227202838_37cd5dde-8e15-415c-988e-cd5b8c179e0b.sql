-- Create trading_names table for multiple trading names
CREATE TABLE public.trading_names (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trading_names ENABLE ROW LEVEL SECURITY;

-- Policies for trading_names
CREATE POLICY "All can view trading names" ON public.trading_names FOR SELECT USING (true);
CREATE POLICY "Admins can manage trading names" ON public.trading_names FOR ALL USING (is_admin_or_owner(auth.uid()));

-- Add default_hourly_rate to company_settings
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS default_hourly_rate NUMERIC DEFAULT 0;

-- Add trading_name_id to jobs table
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS trading_name_id UUID REFERENCES public.trading_names(id);

-- Insert default trading name from existing company settings
INSERT INTO public.trading_names (name, is_default) 
SELECT COALESCE(trading_name, name, 'Default'), true 
FROM public.company_settings 
LIMIT 1
ON CONFLICT DO NOTHING;