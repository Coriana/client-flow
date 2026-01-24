CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_default_role_id uuid;
  v_staff_role_id uuid;
BEGIN
  -- Insert profile for the new user
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  
  -- First user becomes owner AND creates shared data
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role_id)
    SELECT NEW.id, id FROM public.roles WHERE name = 'owner' LIMIT 1;
    
    -- Only create company settings, tax rates, and accounts for the FIRST user
    INSERT INTO public.company_settings (user_id, name)
    VALUES (NEW.id, 'My Company');
    
    INSERT INTO public.tax_rates (user_id, name, rate, is_default)
    VALUES (NEW.id, 'GST', 10, true);
    
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
  ELSE
    -- Subsequent users get the configured default role only
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
  
  RETURN NEW;
END;
$$;