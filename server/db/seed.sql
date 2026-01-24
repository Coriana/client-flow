-- Seed data for Client-Flow Application

-- Default admin user (password: admin123)
-- Password hash generated with bcrypt, 10 rounds
INSERT OR IGNORE INTO profiles (id, email, password_hash, full_name, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@localhost',
  '$2b$10$llDRYNQvpjtssfTHTE3g9.QaGliMm3ZCLo7TiUfnYPSVTsIoggXJ2',
  'Administrator',
  1
);

-- Default roles
INSERT OR IGNORE INTO roles (id, name, description, is_system) VALUES
  ('role-owner', 'Owner', 'Full access to all features', 1),
  ('role-admin', 'Admin', 'Administrative access', 1),
  ('role-staff', 'Staff', 'Standard staff access', 1),
  ('role-readonly', 'Read Only', 'View only access', 1);

-- Resources for permissions
INSERT OR IGNORE INTO resources (id, name, display_name, category, sort_order) VALUES
  ('res-clients', 'clients', 'Clients', 'Business', 1),
  ('res-jobs', 'jobs', 'Jobs', 'Business', 2),
  ('res-invoices', 'invoices', 'Invoices', 'Financial', 3),
  ('res-payments', 'payments', 'Payments', 'Financial', 4),
  ('res-expenses', 'expenses', 'Expenses', 'Financial', 5),
  ('res-purchases', 'purchases', 'Purchases', 'Financial', 6),
  ('res-inventory', 'inventory', 'Inventory', 'Operations', 7),
  ('res-assets', 'assets', 'Assets', 'Operations', 8),
  ('res-issues', 'issues', 'Issues', 'Support', 9),
  ('res-kb', 'kb', 'Knowledge Base', 'Support', 10),
  ('res-team', 'team', 'Team', 'Admin', 11),
  ('res-vendors', 'vendors', 'Vendors', 'Business', 12),
  ('res-locations', 'locations', 'Locations', 'Business', 13),
  ('res-banking', 'banking', 'Banking', 'Financial', 14),
  ('res-reports', 'reports', 'Reports', 'Admin', 15),
  ('res-settings', 'settings', 'Settings', 'Admin', 16);

-- Owner role permissions (full access)
INSERT OR IGNORE INTO role_permissions (id, role_id, resource_id, permission)
SELECT 
  'perm-owner-' || resources.name,
  'role-owner',
  resources.id,
  'write'
FROM resources;

-- Admin role permissions (full access except settings)
INSERT OR IGNORE INTO role_permissions (id, role_id, resource_id, permission)
SELECT 
  'perm-admin-' || resources.name,
  'role-admin',
  resources.id,
  CASE WHEN resources.name = 'settings' THEN 'read' ELSE 'write' END
FROM resources;

-- Staff role permissions
INSERT OR IGNORE INTO role_permissions (id, role_id, resource_id, permission)
SELECT 
  'perm-staff-' || resources.name,
  'role-staff',
  resources.id,
  CASE 
    WHEN resources.name IN ('team', 'settings', 'banking') THEN 'none'
    WHEN resources.name IN ('reports') THEN 'read'
    ELSE 'write'
  END
FROM resources;

-- Read-only role permissions
INSERT OR IGNORE INTO role_permissions (id, role_id, resource_id, permission)
SELECT 
  'perm-readonly-' || resources.name,
  'role-readonly',
  resources.id,
  CASE 
    WHEN resources.name IN ('settings') THEN 'none'
    ELSE 'read'
  END
FROM resources;

-- Assign admin user to owner role
INSERT OR IGNORE INTO user_roles (id, user_id, role_id, role)
VALUES (
  'ur-admin-owner',
  '00000000-0000-0000-0000-000000000001',
  'role-owner',
  'owner'
);

-- Default company settings
INSERT OR IGNORE INTO company_settings (id, name, currency, currency_locale, default_payment_terms, invoice_prefix, invoice_next_number)
VALUES (
  'settings-default',
  'My Company',
  'AUD',
  'en-AU',
  14,
  'INV-',
  1
);

-- Default tax rates
INSERT OR IGNORE INTO tax_rates (id, name, rate, is_default, is_active) VALUES
  ('tax-gst', 'GST', 10, 1, 1),
  ('tax-gst-free', 'GST Free', 0, 0, 1),
  ('tax-bas-excluded', 'BAS Excluded', 0, 0, 1);

-- Default chart of accounts
INSERT OR IGNORE INTO accounts (id, code, name, type, is_system) VALUES
  -- Income
  ('acc-4000', '4000', 'Sales Revenue', 'income', 1),
  ('acc-4100', '4100', 'Service Revenue', 'income', 1),
  ('acc-4200', '4200', 'Rental Income', 'income', 1),
  -- COGS
  ('acc-5000', '5000', 'Cost of Goods Sold', 'cogs', 1),
  ('acc-5100', '5100', 'Direct Labor', 'cogs', 1),
  -- Expenses
  ('acc-6000', '6000', 'General Expenses', 'expense', 1),
  ('acc-6100', '6100', 'Office Supplies', 'expense', 1),
  ('acc-6200', '6200', 'Utilities', 'expense', 1),
  ('acc-6300', '6300', 'Rent', 'expense', 1),
  ('acc-6400', '6400', 'Insurance', 'expense', 1),
  ('acc-6500', '6500', 'Professional Fees', 'expense', 1),
  ('acc-6600', '6600', 'Travel & Entertainment', 'expense', 1),
  ('acc-6700', '6700', 'Marketing & Advertising', 'expense', 1),
  ('acc-6800', '6800', 'Depreciation', 'expense', 1),
  -- Assets
  ('acc-1000', '1000', 'Cash at Bank', 'asset', 1),
  ('acc-1100', '1100', 'Accounts Receivable', 'asset', 1),
  ('acc-1200', '1200', 'Inventory', 'asset', 1),
  ('acc-1500', '1500', 'Equipment', 'asset', 1),
  -- Liabilities
  ('acc-2000', '2000', 'Accounts Payable', 'liability', 1),
  ('acc-2100', '2100', 'GST Collected', 'liability', 1),
  ('acc-2200', '2200', 'GST Paid', 'liability', 1),
  -- Equity
  ('acc-3000', '3000', 'Owner''s Equity', 'equity', 1),
  ('acc-3100', '3100', 'Retained Earnings', 'equity', 1);
