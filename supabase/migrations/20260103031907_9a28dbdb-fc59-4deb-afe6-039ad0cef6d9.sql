-- Add branding columns to company_settings
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS app_name TEXT DEFAULT 'WorkFlow',
ADD COLUMN IF NOT EXISTS favicon_url TEXT;