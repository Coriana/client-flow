-- Add currency columns to company_settings
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS currency text DEFAULT 'AUD',
ADD COLUMN IF NOT EXISTS currency_locale text DEFAULT 'en-AU';

-- Add default_role_id to company_settings
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS default_role_id uuid REFERENCES public.roles(id);

-- Insert activity_log resource
INSERT INTO public.resources (name, display_name, category)
VALUES ('activity_log', 'Activity Log', 'Settings')
ON CONFLICT (name) DO NOTHING;

-- Set default permissions for activity_log resource
INSERT INTO public.role_permissions (role_id, resource_id, permission)
SELECT r.id, res.id, 
  CASE 
    WHEN r.name = 'owner' THEN 'write'::permission_level
    WHEN r.name = 'admin' THEN 'read'::permission_level
    WHEN r.name = 'readonly' THEN 'read'::permission_level
    ELSE 'none'::permission_level
  END
FROM public.roles r
CROSS JOIN public.resources res
WHERE res.name = 'activity_log'
ON CONFLICT DO NOTHING;

-- Update handle_new_user function to use default_role_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_default_role_id uuid;
  v_staff_role_id uuid;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  
  -- First user becomes owner
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role_id)
    SELECT NEW.id, id FROM public.roles WHERE name = 'owner' LIMIT 1;
  ELSE
    -- Get configured default role, fallback to staff
    SELECT default_role_id INTO v_default_role_id
    FROM public.company_settings
    LIMIT 1;
    
    IF v_default_role_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id)
      VALUES (NEW.id, v_default_role_id);
    ELSE
      SELECT id INTO v_staff_role_id FROM public.roles WHERE name = 'staff' LIMIT 1;
      INSERT INTO public.user_roles (user_id, role_id)
      VALUES (NEW.id, v_staff_role_id);
    END IF;
  END IF;
  
  -- Create default company settings for new user
  INSERT INTO public.company_settings (user_id, name)
  VALUES (NEW.id, 'My Company');
  
  -- Create default tax rate for new user
  INSERT INTO public.tax_rates (user_id, name, rate, is_default)
  VALUES (NEW.id, 'GST', 10, true);
  
  -- Create default chart of accounts for new user
  INSERT INTO public.accounts (user_id, code, name, type, is_system) VALUES
    (NEW.id, '1000', 'Bank Account', 'asset', true),
    (NEW.id, '1100', 'Accounts Receivable', 'asset', true),
    (NEW.id, '2000', 'Accounts Payable', 'liability', true),
    (NEW.id, '2100', 'GST Collected', 'liability', true),
    (NEW.id, '2200', 'GST Paid', 'asset', true),
    (NEW.id, '3000', 'Retained Earnings', 'equity', true),
    (NEW.id, '4000', 'Sales Revenue', 'income', true),
    (NEW.id, '5000', 'Cost of Goods Sold', 'cogs', true),
    (NEW.id, '6000', 'Operating Expenses', 'expense', true);
  
  RETURN NEW;
END;
$function$;