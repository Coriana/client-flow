-- Create permission_level enum
CREATE TYPE public.permission_level AS ENUM ('none', 'read', 'write');

-- Create roles table for custom roles
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create resources table (define controllable areas)
CREATE TABLE public.resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  category text,
  sort_order integer DEFAULT 0
);

-- Create role_permissions table (permission matrix)
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid REFERENCES public.roles(id) ON DELETE CASCADE NOT NULL,
  resource_id uuid REFERENCES public.resources(id) ON DELETE CASCADE NOT NULL,
  permission permission_level DEFAULT 'none',
  created_at timestamptz DEFAULT now(),
  UNIQUE(role_id, resource_id)
);

-- Enable RLS on new tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Insert default system roles
INSERT INTO public.roles (name, description, is_system) VALUES
  ('owner', 'Full system access including role management', true),
  ('admin', 'Manage all data and team members', true),
  ('staff', 'Standard access to business operations', true),
  ('readonly', 'View-only access to all data', true);

-- Insert all resources
INSERT INTO public.resources (name, display_name, category, sort_order) VALUES
  ('clients', 'Clients', 'Sales', 1),
  ('jobs', 'Jobs', 'Sales', 2),
  ('invoices', 'Invoices', 'Finance', 3),
  ('payments', 'Payments', 'Finance', 4),
  ('vendors', 'Vendors', 'Purchasing', 5),
  ('purchases', 'Purchases', 'Purchasing', 6),
  ('items', 'Inventory Items', 'Operations', 7),
  ('assets', 'Assets', 'Operations', 8),
  ('issues', 'Issues', 'Operations', 9),
  ('timesheets', 'Timesheets', 'Operations', 10),
  ('expenses', 'Expenses', 'Finance', 11),
  ('reports', 'Reports', 'Analytics', 12),
  ('team', 'Team Management', 'Settings', 13),
  ('settings', 'Company Settings', 'Settings', 14),
  ('roles', 'Role Management', 'Settings', 15);

-- Set up default permissions for system roles
-- Owner gets write on everything
INSERT INTO public.role_permissions (role_id, resource_id, permission)
SELECT r.id, res.id, 'write'::permission_level
FROM public.roles r, public.resources res
WHERE r.name = 'owner';

-- Admin gets write on everything except roles
INSERT INTO public.role_permissions (role_id, resource_id, permission)
SELECT r.id, res.id, 
  CASE WHEN res.name = 'roles' THEN 'none'::permission_level ELSE 'write'::permission_level END
FROM public.roles r, public.resources res
WHERE r.name = 'admin';

-- Staff gets mixed permissions
INSERT INTO public.role_permissions (role_id, resource_id, permission)
SELECT r.id, res.id,
  CASE 
    WHEN res.name IN ('clients', 'jobs', 'invoices', 'payments', 'issues', 'timesheets', 'expenses') THEN 'write'::permission_level
    WHEN res.name IN ('vendors', 'purchases', 'items', 'assets', 'reports', 'settings') THEN 'read'::permission_level
    ELSE 'none'::permission_level
  END
FROM public.roles r, public.resources res
WHERE r.name = 'staff';

-- Readonly gets read on everything except team and roles
INSERT INTO public.role_permissions (role_id, resource_id, permission)
SELECT r.id, res.id,
  CASE 
    WHEN res.name IN ('team', 'roles') THEN 'none'::permission_level
    ELSE 'read'::permission_level
  END
FROM public.roles r, public.resources res
WHERE r.name = 'readonly';

-- Add role_id column to user_roles table
ALTER TABLE public.user_roles ADD COLUMN role_id uuid REFERENCES public.roles(id);

-- Migrate existing role enum values to role_id
UPDATE public.user_roles ur
SET role_id = r.id
FROM public.roles r
WHERE ur.role::text = r.name;

-- Make role_id NOT NULL after migration
ALTER TABLE public.user_roles ALTER COLUMN role_id SET NOT NULL;

-- Create function to get user's permission level for a resource
CREATE OR REPLACE FUNCTION public.get_user_permission(_user_id uuid, _resource_name text)
RETURNS permission_level
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT rp.permission 
     FROM role_permissions rp
     JOIN roles r ON r.id = rp.role_id
     JOIN user_roles ur ON ur.role_id = r.id
     JOIN resources res ON res.id = rp.resource_id
     WHERE ur.user_id = _user_id AND res.name = _resource_name
     ORDER BY 
       CASE rp.permission 
         WHEN 'write' THEN 1 
         WHEN 'read' THEN 2 
         ELSE 3 
       END
     LIMIT 1),
    'none'::permission_level
  )
$$;

-- Check if user can read a resource
CREATE OR REPLACE FUNCTION public.can_read(_resource_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT get_user_permission(auth.uid(), _resource_name) IN ('read', 'write')
$$;

-- Check if user can write to a resource
CREATE OR REPLACE FUNCTION public.can_write(_resource_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT get_user_permission(auth.uid(), _resource_name) = 'write'
$$;

-- Check if user is owner
CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id AND r.name = 'owner'
  )
$$;

-- RLS policies for roles table
CREATE POLICY "Anyone can view roles"
ON public.roles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only owners can manage roles"
ON public.roles FOR ALL
TO authenticated
USING (is_owner(auth.uid()))
WITH CHECK (is_owner(auth.uid()));

-- RLS policies for resources table
CREATE POLICY "Anyone can view resources"
ON public.resources FOR SELECT
TO authenticated
USING (true);

-- RLS policies for role_permissions table
CREATE POLICY "Anyone can view role permissions"
ON public.role_permissions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only owners can manage role permissions"
ON public.role_permissions FOR ALL
TO authenticated
USING (is_owner(auth.uid()))
WITH CHECK (is_owner(auth.uid()));