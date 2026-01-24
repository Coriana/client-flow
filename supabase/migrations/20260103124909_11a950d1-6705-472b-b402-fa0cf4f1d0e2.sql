-- Create a function that checks if initial setup is complete
-- This bypasses RLS so any authenticated user can check
CREATE OR REPLACE FUNCTION public.is_setup_complete()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_setup_completed boolean;
BEGIN
  SELECT setup_completed INTO v_setup_completed
  FROM public.company_settings
  LIMIT 1;
  
  -- If no settings exist or not completed, return false
  RETURN COALESCE(v_setup_completed, false);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_setup_complete() TO authenticated;

-- Store pending bill imports for API-driven workflow
CREATE TABLE public.bill_import_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES vendors(id),
  vendor_name text,
  file_name text,
  raw_data jsonb NOT NULL,
  column_mapping jsonb,
  matched_rows jsonb,
  status text NOT NULL DEFAULT 'pending',
  total_amount numeric,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bill_import_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view bill import sessions"
  ON bill_import_sessions FOR SELECT
  USING (can_read('payments'));

CREATE POLICY "Users can create bill import sessions"
  ON bill_import_sessions FOR INSERT
  WITH CHECK (can_write('payments'));

CREATE POLICY "Users can update bill import sessions"
  ON bill_import_sessions FOR UPDATE
  USING (can_write('payments'));

CREATE POLICY "Users can delete bill import sessions"
  ON bill_import_sessions FOR DELETE
  USING (can_write('payments'));

-- Trigger for updated_at
CREATE TRIGGER update_bill_import_sessions_updated_at
  BEFORE UPDATE ON bill_import_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();