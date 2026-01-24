-- Fix the log_activity function to use JSONB extraction instead of direct column references
CREATE OR REPLACE FUNCTION public.log_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_entity_name TEXT;
  v_description TEXT;
BEGIN
  -- Extract entity name based on table
  IF TG_OP = 'DELETE' THEN
    v_entity_name := CASE TG_TABLE_NAME
      WHEN 'clients' THEN OLD.name
      WHEN 'jobs' THEN OLD.name
      WHEN 'invoices' THEN OLD.invoice_number
      WHEN 'issues' THEN OLD.title
      WHEN 'assets' THEN OLD.name
      WHEN 'items' THEN OLD.name
      WHEN 'vendors' THEN OLD.name
      WHEN 'timesheets' THEN NULL
      WHEN 'expenses' THEN OLD.description
      WHEN 'payments' THEN NULL
      ELSE NULL
    END;
  ELSE
    v_entity_name := CASE TG_TABLE_NAME
      WHEN 'clients' THEN NEW.name
      WHEN 'jobs' THEN NEW.name
      WHEN 'invoices' THEN NEW.invoice_number
      WHEN 'issues' THEN NEW.title
      WHEN 'assets' THEN NEW.name
      WHEN 'items' THEN NEW.name
      WHEN 'vendors' THEN NEW.name
      WHEN 'timesheets' THEN NULL
      WHEN 'expenses' THEN NEW.description
      WHEN 'payments' THEN NULL
      ELSE NULL
    END;
  END IF;

  -- Build description
  v_description := TG_OP || ' ' || TG_TABLE_NAME;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, description, new_values)
    VALUES (
      auth.uid(),
      'created',
      TG_TABLE_NAME,
      NEW.id,
      v_entity_name,
      v_description,
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, description, old_values, new_values)
    VALUES (
      auth.uid(),
      'updated',
      TG_TABLE_NAME,
      NEW.id,
      v_entity_name,
      v_description,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, description, old_values)
    VALUES (
      auth.uid(),
      'deleted',
      TG_TABLE_NAME,
      OLD.id,
      v_entity_name,
      v_description,
      to_jsonb(OLD)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- Drop existing triggers and recreate them for specific tables only
-- This ensures each table only triggers for its own columns

DROP TRIGGER IF EXISTS clients_activity_log ON clients;
DROP TRIGGER IF EXISTS jobs_activity_log ON jobs;
DROP TRIGGER IF EXISTS invoices_activity_log ON invoices;
DROP TRIGGER IF EXISTS payments_activity_log ON payments;
DROP TRIGGER IF EXISTS issues_activity_log ON issues;
DROP TRIGGER IF EXISTS assets_activity_log ON assets;
DROP TRIGGER IF EXISTS items_activity_log ON items;
DROP TRIGGER IF EXISTS timesheets_activity_log ON timesheets;
DROP TRIGGER IF EXISTS expenses_activity_log ON expenses;
DROP TRIGGER IF EXISTS vendors_activity_log ON vendors;

-- Create individual trigger functions for each table to avoid column reference issues
CREATE OR REPLACE FUNCTION log_clients_activity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, description, old_values)
    VALUES (auth.uid(), 'deleted', 'clients', OLD.id, OLD.name, 'DELETE clients', to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, description, old_values, new_values)
    VALUES (auth.uid(), 'updated', 'clients', NEW.id, NEW.name, 'UPDATE clients', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, description, new_values)
    VALUES (auth.uid(), 'created', 'clients', NEW.id, NEW.name, 'INSERT clients', to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END; $$;

CREATE OR REPLACE FUNCTION log_jobs_activity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, description, old_values)
    VALUES (auth.uid(), 'deleted', 'jobs', OLD.id, OLD.name, 'DELETE jobs', to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, description, old_values, new_values)
    VALUES (auth.uid(), 'updated', 'jobs', NEW.id, NEW.name, 'UPDATE jobs', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, description, new_values)
    VALUES (auth.uid(), 'created', 'jobs', NEW.id, NEW.name, 'INSERT jobs', to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END; $$;

CREATE OR REPLACE FUNCTION log_invoices_activity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, description, old_values)
    VALUES (auth.uid(), 'deleted', 'invoices', OLD.id, OLD.invoice_number, 'DELETE invoices', to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, description, old_values, new_values)
    VALUES (auth.uid(), 'updated', 'invoices', NEW.id, NEW.invoice_number, 'UPDATE invoices', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, description, new_values)
    VALUES (auth.uid(), 'created', 'invoices', NEW.id, NEW.invoice_number, 'INSERT invoices', to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END; $$;

CREATE OR REPLACE FUNCTION log_payments_activity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, description, new_values)
    VALUES (auth.uid(), 'created', 'payments', NEW.id, NULL, 'INSERT payments', to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END; $$;

CREATE OR REPLACE FUNCTION log_issues_activity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, description, old_values)
    VALUES (auth.uid(), 'deleted', 'issues', OLD.id, OLD.title, 'DELETE issues', to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, description, old_values, new_values)
    VALUES (auth.uid(), 'updated', 'issues', NEW.id, NEW.title, 'UPDATE issues', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, description, new_values)
    VALUES (auth.uid(), 'created', 'issues', NEW.id, NEW.title, 'INSERT issues', to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END; $$;

CREATE OR REPLACE FUNCTION log_assets_activity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, description, old_values)
    VALUES (auth.uid(), 'deleted', 'assets', OLD.id, OLD.name, 'DELETE assets', to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, description, old_values, new_values)
    VALUES (auth.uid(), 'updated', 'assets', NEW.id, NEW.name, 'UPDATE assets', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, description, new_values)
    VALUES (auth.uid(), 'created', 'assets', NEW.id, NEW.name, 'INSERT assets', to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END; $$;

CREATE OR REPLACE FUNCTION log_items_activity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, description, old_values)
    VALUES (auth.uid(), 'deleted', 'items', OLD.id, OLD.name, 'DELETE items', to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, description, old_values, new_values)
    VALUES (auth.uid(), 'updated', 'items', NEW.id, NEW.name, 'UPDATE items', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, description, new_values)
    VALUES (auth.uid(), 'created', 'items', NEW.id, NEW.name, 'INSERT items', to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END; $$;

CREATE OR REPLACE FUNCTION log_timesheets_activity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, description, old_values)
    VALUES (auth.uid(), 'deleted', 'timesheets', OLD.id, NULL, 'DELETE timesheets', to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, description, old_values, new_values)
    VALUES (auth.uid(), 'updated', 'timesheets', NEW.id, NULL, 'UPDATE timesheets', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, description, new_values)
    VALUES (auth.uid(), 'created', 'timesheets', NEW.id, NULL, 'INSERT timesheets', to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END; $$;

CREATE OR REPLACE FUNCTION log_expenses_activity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, description, old_values)
    VALUES (auth.uid(), 'deleted', 'expenses', OLD.id, OLD.description, 'DELETE expenses', to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, description, old_values, new_values)
    VALUES (auth.uid(), 'updated', 'expenses', NEW.id, NEW.description, 'UPDATE expenses', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, description, new_values)
    VALUES (auth.uid(), 'created', 'expenses', NEW.id, NEW.description, 'INSERT expenses', to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END; $$;

CREATE OR REPLACE FUNCTION log_vendors_activity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, description, old_values)
    VALUES (auth.uid(), 'deleted', 'vendors', OLD.id, OLD.name, 'DELETE vendors', to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, description, old_values, new_values)
    VALUES (auth.uid(), 'updated', 'vendors', NEW.id, NEW.name, 'UPDATE vendors', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, description, new_values)
    VALUES (auth.uid(), 'created', 'vendors', NEW.id, NEW.name, 'INSERT vendors', to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END; $$;

-- Create triggers using table-specific functions
CREATE TRIGGER clients_activity_log AFTER INSERT OR UPDATE OR DELETE ON clients FOR EACH ROW EXECUTE FUNCTION log_clients_activity();
CREATE TRIGGER jobs_activity_log AFTER INSERT OR UPDATE OR DELETE ON jobs FOR EACH ROW EXECUTE FUNCTION log_jobs_activity();
CREATE TRIGGER invoices_activity_log AFTER INSERT OR UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION log_invoices_activity();
CREATE TRIGGER payments_activity_log AFTER INSERT ON payments FOR EACH ROW EXECUTE FUNCTION log_payments_activity();
CREATE TRIGGER issues_activity_log AFTER INSERT OR UPDATE ON issues FOR EACH ROW EXECUTE FUNCTION log_issues_activity();
CREATE TRIGGER assets_activity_log AFTER INSERT OR UPDATE OR DELETE ON assets FOR EACH ROW EXECUTE FUNCTION log_assets_activity();
CREATE TRIGGER items_activity_log AFTER INSERT OR UPDATE ON items FOR EACH ROW EXECUTE FUNCTION log_items_activity();
CREATE TRIGGER timesheets_activity_log AFTER INSERT OR UPDATE OR DELETE ON timesheets FOR EACH ROW EXECUTE FUNCTION log_timesheets_activity();
CREATE TRIGGER expenses_activity_log AFTER INSERT OR UPDATE OR DELETE ON expenses FOR EACH ROW EXECUTE FUNCTION log_expenses_activity();
CREATE TRIGGER vendors_activity_log AFTER INSERT OR UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION log_vendors_activity();