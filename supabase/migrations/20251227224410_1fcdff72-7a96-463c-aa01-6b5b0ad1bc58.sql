-- Create client_contacts table for multiple contacts per client
CREATE TABLE public.client_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  title text,
  email text,
  phone text,
  is_primary boolean DEFAULT false,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "All can view client contacts"
ON public.client_contacts FOR SELECT
USING (true);

CREATE POLICY "Staff can manage client contacts"
ON public.client_contacts FOR ALL
USING (NOT has_role(auth.uid(), 'readonly'));

-- Create client_contact_history table for tracking changes
CREATE TABLE public.client_contact_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL,
  contact_id uuid,
  event_type text NOT NULL, -- 'created', 'updated', 'deleted', 'set_primary'
  description text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_contact_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "All can view client contact history"
ON public.client_contact_history FOR SELECT
USING (true);

CREATE POLICY "Staff can insert client contact history"
ON public.client_contact_history FOR INSERT
WITH CHECK (NOT has_role(auth.uid(), 'readonly'));

-- Trigger to update updated_at
CREATE TRIGGER update_client_contacts_updated_at
BEFORE UPDATE ON public.client_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();