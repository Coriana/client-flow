-- Add additional columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC;

-- Create profile_history table for audit trail
CREATE TABLE public.profile_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  changed_by UUID,
  api_key_id UUID REFERENCES api_keys(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_profile_history_profile ON profile_history(profile_id);
CREATE INDEX idx_profile_history_created ON profile_history(created_at);

-- Enable RLS on profile_history
ALTER TABLE profile_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for profile_history
CREATE POLICY "Users can view profile history"
ON profile_history FOR SELECT
USING (can_read('team'));

CREATE POLICY "Users can insert profile history"
ON profile_history FOR INSERT
WITH CHECK (can_write('team'));

-- Create trigger function for automatic history logging
CREATE OR REPLACE FUNCTION log_profile_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changes_description TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Build description of what changed
    changes_description := 'Profile updated';
    
    IF OLD.full_name IS DISTINCT FROM NEW.full_name THEN
      changes_description := changes_description || ': name changed';
    END IF;
    
    IF OLD.phone IS DISTINCT FROM NEW.phone THEN
      changes_description := changes_description || ': phone changed';
    END IF;
    
    IF OLD.department IS DISTINCT FROM NEW.department THEN
      changes_description := changes_description || ': department changed';
    END IF;
    
    IF OLD.job_title IS DISTINCT FROM NEW.job_title THEN
      changes_description := changes_description || ': job title changed';
    END IF;
    
    IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
      IF NEW.is_active THEN
        changes_description := 'Profile reactivated';
      ELSE
        changes_description := 'Profile deactivated';
      END IF;
    END IF;

    INSERT INTO profile_history (profile_id, event_type, description, old_values, new_values, changed_by)
    VALUES (
      NEW.id,
      'updated',
      changes_description,
      jsonb_build_object(
        'full_name', OLD.full_name,
        'phone', OLD.phone,
        'birthday', OLD.birthday,
        'address', OLD.address,
        'department', OLD.department,
        'job_title', OLD.job_title,
        'emergency_contact_name', OLD.emergency_contact_name,
        'emergency_contact_phone', OLD.emergency_contact_phone,
        'notes', OLD.notes,
        'is_active', OLD.is_active,
        'hourly_rate', OLD.hourly_rate
      ),
      jsonb_build_object(
        'full_name', NEW.full_name,
        'phone', NEW.phone,
        'birthday', NEW.birthday,
        'address', NEW.address,
        'department', NEW.department,
        'job_title', NEW.job_title,
        'emergency_contact_name', NEW.emergency_contact_name,
        'emergency_contact_phone', NEW.emergency_contact_phone,
        'notes', NEW.notes,
        'is_active', NEW.is_active,
        'hourly_rate', NEW.hourly_rate
      ),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS profile_changes_trigger ON profiles;
CREATE TRIGGER profile_changes_trigger
AFTER UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION log_profile_changes();