-- Add setup_completed flag to company_settings
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN DEFAULT FALSE;