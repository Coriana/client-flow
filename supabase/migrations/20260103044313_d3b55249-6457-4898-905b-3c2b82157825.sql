
-- Add entity_name and description columns to activity_log
ALTER TABLE activity_log 
ADD COLUMN IF NOT EXISTS entity_name TEXT,
ADD COLUMN IF NOT EXISTS description TEXT;

-- Generic activity logging function with entity name extraction
CREATE OR REPLACE FUNCTION log_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Create triggers for each table
CREATE TRIGGER clients_activity_log AFTER INSERT OR UPDATE OR DELETE ON clients
  FOR EACH ROW EXECUTE FUNCTION log_activity();

CREATE TRIGGER jobs_activity_log AFTER INSERT OR UPDATE OR DELETE ON jobs
  FOR EACH ROW EXECUTE FUNCTION log_activity();

CREATE TRIGGER invoices_activity_log AFTER INSERT OR UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION log_activity();

CREATE TRIGGER payments_activity_log AFTER INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION log_activity();

CREATE TRIGGER issues_activity_log AFTER INSERT OR UPDATE ON issues
  FOR EACH ROW EXECUTE FUNCTION log_activity();

CREATE TRIGGER assets_activity_log AFTER INSERT OR UPDATE OR DELETE ON assets
  FOR EACH ROW EXECUTE FUNCTION log_activity();

CREATE TRIGGER items_activity_log AFTER INSERT OR UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION log_activity();

CREATE TRIGGER timesheets_activity_log AFTER INSERT OR UPDATE OR DELETE ON timesheets
  FOR EACH ROW EXECUTE FUNCTION log_activity();

CREATE TRIGGER expenses_activity_log AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW EXECUTE FUNCTION log_activity();

CREATE TRIGGER vendors_activity_log AFTER INSERT OR UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION log_activity();
