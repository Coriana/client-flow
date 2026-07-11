-- SQLite Schema for Client-Flow Application
-- Converted from Supabase PostgreSQL schema

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- ============================================
-- CORE TABLES
-- ============================================

-- Profiles (users)
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  address TEXT,
  job_title TEXT,
  department TEXT,
  hourly_rate REAL,
  start_date TEXT,
  birthday TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  notes TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Roles
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_system INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Resources (for permissions)
CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  category TEXT,
  sort_order INTEGER
);

-- Role Permissions
CREATE TABLE IF NOT EXISTS role_permissions (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  permission TEXT CHECK(permission IN ('none', 'read', 'write')),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(role_id, resource_id)
);

-- User Roles
CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  role TEXT CHECK(role IN ('owner', 'admin', 'staff', 'readonly')) DEFAULT 'staff',
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, role_id)
);

-- Profile History
CREATE TABLE IF NOT EXISTS profile_history (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  old_values TEXT,
  new_values TEXT,
  changed_by TEXT,
  api_key_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- BUSINESS ENTITIES
-- ============================================

-- Locations
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location_type TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postcode TEXT,
  country TEXT,
  phone TEXT,
  email TEXT,
  latitude REAL,
  longitude REAL,
  notes TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Location Contacts
CREATE TABLE IF NOT EXISTS location_contacts (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  phone TEXT,
  email TEXT,
  is_primary INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Clients
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  trading_name TEXT,
  abn TEXT,
  acn TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  billing_address TEXT,
  payment_terms INTEGER,
  notes TEXT,
  default_billable_time INTEGER DEFAULT 1,
  default_billable_expenses INTEGER DEFAULT 1,
  location_id TEXT REFERENCES locations(id),
  is_active INTEGER DEFAULT 1,
  user_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Client Contacts
CREATE TABLE IF NOT EXISTS client_contacts (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  is_primary INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Client Contact History
CREATE TABLE IF NOT EXISTS client_contact_history (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  contact_id TEXT,
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  old_values TEXT,
  new_values TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Vendors
CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  notes TEXT,
  credit_balance REAL DEFAULT 0,
  location_id TEXT REFERENCES locations(id),
  is_active INTEGER DEFAULT 1,
  user_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Vendor Contacts. FROZEN ARCHIVE - like client_contacts above, this table is
-- superseded by the person-centric contacts + contact_affiliations tables
-- (see the migration in database.ts); the app no longer reads or writes it.
CREATE TABLE IF NOT EXISTS vendor_contacts (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  is_primary INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Contacts (people, independent of any one organisation). client_contacts and
-- vendor_contacts remain as frozen archives (see the migrations in
-- database.ts); new contact data lives here, affiliated to clients/vendors
-- over time via contact_affiliations below.
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- A contact's affiliation with a client OR a vendor over a period of time.
-- end_date NULL = current affiliation.
CREATE TABLE IF NOT EXISTS contact_affiliations (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
  vendor_id TEXT REFERENCES vendors(id) ON DELETE CASCADE,
  title TEXT,
  is_primary INTEGER DEFAULT 0,
  start_date TEXT,
  end_date TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  CHECK ((client_id IS NULL) <> (vendor_id IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_contact_affiliations_contact ON contact_affiliations(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_affiliations_client ON contact_affiliations(client_id);
CREATE INDEX IF NOT EXISTS idx_contact_affiliations_vendor ON contact_affiliations(vendor_id);

-- Keep clients.contact_name/contact_email/contact_phone and
-- vendors.contact_name/contact_email/contact_phone (read by invoice-emailing
-- fallback and the external API) in sync with each org's *current primary*
-- contact (contact_affiliations.is_primary = 1 AND end_date IS NULL). These
-- triggers recompute from scratch on every relevant mutation, so every
-- mutation path (insert, primary/end_date change, delete, or an edit to the
-- contact's own name/email/phone) converges on the same result: the primary
-- contact's info, or NULL if the org currently has no primary. Overlapping
-- affiliations are allowed (a person can be primary at more than one org at
-- once) - each org's columns are recomputed independently, so there is no
-- cross-org exclusivity here.
--
-- WHERE id = NEW.client_id / OLD.client_id is a deliberate no-op when the
-- affiliation targets a vendor (client_id NULL): `id = NULL` matches zero
-- rows, so the clients-branch of these triggers is inert for vendor-side
-- affiliations, and vice versa for the vendors branch.
CREATE TRIGGER IF NOT EXISTS trg_contact_affiliations_sync_ai
AFTER INSERT ON contact_affiliations
BEGIN
  UPDATE clients SET
    contact_name = (SELECT c.name FROM contact_affiliations ca JOIN contacts c ON c.id = ca.contact_id WHERE ca.client_id = NEW.client_id AND ca.is_primary = 1 AND ca.end_date IS NULL LIMIT 1),
    contact_email = (SELECT c.email FROM contact_affiliations ca JOIN contacts c ON c.id = ca.contact_id WHERE ca.client_id = NEW.client_id AND ca.is_primary = 1 AND ca.end_date IS NULL LIMIT 1),
    contact_phone = (SELECT c.phone FROM contact_affiliations ca JOIN contacts c ON c.id = ca.contact_id WHERE ca.client_id = NEW.client_id AND ca.is_primary = 1 AND ca.end_date IS NULL LIMIT 1)
  WHERE id = NEW.client_id;

  UPDATE vendors SET
    contact_name = (SELECT c.name FROM contact_affiliations ca JOIN contacts c ON c.id = ca.contact_id WHERE ca.vendor_id = NEW.vendor_id AND ca.is_primary = 1 AND ca.end_date IS NULL LIMIT 1),
    contact_email = (SELECT c.email FROM contact_affiliations ca JOIN contacts c ON c.id = ca.contact_id WHERE ca.vendor_id = NEW.vendor_id AND ca.is_primary = 1 AND ca.end_date IS NULL LIMIT 1),
    contact_phone = (SELECT c.phone FROM contact_affiliations ca JOIN contacts c ON c.id = ca.contact_id WHERE ca.vendor_id = NEW.vendor_id AND ca.is_primary = 1 AND ca.end_date IS NULL LIMIT 1)
  WHERE id = NEW.vendor_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_contact_affiliations_sync_au
AFTER UPDATE OF is_primary, end_date ON contact_affiliations
BEGIN
  UPDATE clients SET
    contact_name = (SELECT c.name FROM contact_affiliations ca JOIN contacts c ON c.id = ca.contact_id WHERE ca.client_id = NEW.client_id AND ca.is_primary = 1 AND ca.end_date IS NULL LIMIT 1),
    contact_email = (SELECT c.email FROM contact_affiliations ca JOIN contacts c ON c.id = ca.contact_id WHERE ca.client_id = NEW.client_id AND ca.is_primary = 1 AND ca.end_date IS NULL LIMIT 1),
    contact_phone = (SELECT c.phone FROM contact_affiliations ca JOIN contacts c ON c.id = ca.contact_id WHERE ca.client_id = NEW.client_id AND ca.is_primary = 1 AND ca.end_date IS NULL LIMIT 1)
  WHERE id = NEW.client_id;

  UPDATE vendors SET
    contact_name = (SELECT c.name FROM contact_affiliations ca JOIN contacts c ON c.id = ca.contact_id WHERE ca.vendor_id = NEW.vendor_id AND ca.is_primary = 1 AND ca.end_date IS NULL LIMIT 1),
    contact_email = (SELECT c.email FROM contact_affiliations ca JOIN contacts c ON c.id = ca.contact_id WHERE ca.vendor_id = NEW.vendor_id AND ca.is_primary = 1 AND ca.end_date IS NULL LIMIT 1),
    contact_phone = (SELECT c.phone FROM contact_affiliations ca JOIN contacts c ON c.id = ca.contact_id WHERE ca.vendor_id = NEW.vendor_id AND ca.is_primary = 1 AND ca.end_date IS NULL LIMIT 1)
  WHERE id = NEW.vendor_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_contact_affiliations_sync_ad
AFTER DELETE ON contact_affiliations
BEGIN
  UPDATE clients SET
    contact_name = (SELECT c.name FROM contact_affiliations ca JOIN contacts c ON c.id = ca.contact_id WHERE ca.client_id = OLD.client_id AND ca.is_primary = 1 AND ca.end_date IS NULL LIMIT 1),
    contact_email = (SELECT c.email FROM contact_affiliations ca JOIN contacts c ON c.id = ca.contact_id WHERE ca.client_id = OLD.client_id AND ca.is_primary = 1 AND ca.end_date IS NULL LIMIT 1),
    contact_phone = (SELECT c.phone FROM contact_affiliations ca JOIN contacts c ON c.id = ca.contact_id WHERE ca.client_id = OLD.client_id AND ca.is_primary = 1 AND ca.end_date IS NULL LIMIT 1)
  WHERE id = OLD.client_id;

  UPDATE vendors SET
    contact_name = (SELECT c.name FROM contact_affiliations ca JOIN contacts c ON c.id = ca.contact_id WHERE ca.vendor_id = OLD.vendor_id AND ca.is_primary = 1 AND ca.end_date IS NULL LIMIT 1),
    contact_email = (SELECT c.email FROM contact_affiliations ca JOIN contacts c ON c.id = ca.contact_id WHERE ca.vendor_id = OLD.vendor_id AND ca.is_primary = 1 AND ca.end_date IS NULL LIMIT 1),
    contact_phone = (SELECT c.phone FROM contact_affiliations ca JOIN contacts c ON c.id = ca.contact_id WHERE ca.vendor_id = OLD.vendor_id AND ca.is_primary = 1 AND ca.end_date IS NULL LIMIT 1)
  WHERE id = OLD.vendor_id;
END;

-- If the primary contact's own name/email/phone changes, propagate to every
-- client/vendor that currently has them as primary (could be more than one -
-- overlapping affiliations are allowed, so this is not a single-row update).
CREATE TRIGGER IF NOT EXISTS trg_contacts_sync_au
AFTER UPDATE OF name, email, phone ON contacts
BEGIN
  UPDATE clients SET
    contact_name = NEW.name,
    contact_email = NEW.email,
    contact_phone = NEW.phone
  WHERE id IN (
    SELECT client_id FROM contact_affiliations
    WHERE contact_id = NEW.id AND is_primary = 1 AND end_date IS NULL AND client_id IS NOT NULL
  );

  UPDATE vendors SET
    contact_name = NEW.name,
    contact_email = NEW.email,
    contact_phone = NEW.phone
  WHERE id IN (
    SELECT vendor_id FROM contact_affiliations
    WHERE contact_id = NEW.id AND is_primary = 1 AND end_date IS NULL AND vendor_id IS NOT NULL
  );
END;

-- Trading Names
CREATE TABLE IF NOT EXISTS trading_names (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  abn TEXT,
  bank_name TEXT,
  bank_bsb TEXT,
  bank_account_number TEXT,
  bank_account_name TEXT,
  paypal_email TEXT,
  other_payment_details TEXT,
  is_active INTEGER DEFAULT 1,
  is_default INTEGER DEFAULT 0,
  user_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- JOBS & PROJECTS
-- ============================================

-- Jobs
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  job_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK(status IN ('prospect', 'active', 'on_hold', 'complete', 'archived')) DEFAULT 'prospect',
  client_id TEXT REFERENCES clients(id),
  location_id TEXT REFERENCES locations(id),
  trading_name_id TEXT REFERENCES trading_names(id),
  start_date TEXT,
  end_date TEXT,
  budget REAL,
  hourly_rate REAL,
  is_recurring INTEGER DEFAULT 0,
  recurring_rate REAL,
  billing_day INTEGER,
  invoice_lead_days INTEGER,
  next_invoice_date TEXT,
  tags TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Job Assignments
CREATE TABLE IF NOT EXISTS job_assignments (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(job_id, user_id)
);

-- Timesheets
CREATE TABLE IF NOT EXISTS timesheets (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  hours REAL NOT NULL,
  description TEXT,
  category TEXT,
  rate_override REAL,
  is_billable INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  job_id TEXT REFERENCES jobs(id),
  vendor_id TEXT REFERENCES vendors(id),
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  receipt_url TEXT,
  is_billable INTEGER DEFAULT 1,
  is_reimbursement INTEGER DEFAULT 0,
  user_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- ASSETS
-- ============================================

-- Assets
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  asset_tag TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  asset_type TEXT,
  serial_number TEXT,
  status TEXT CHECK(status IN ('in_service', 'spare', 'retired')) DEFAULT 'in_service',
  location TEXT,
  location_id TEXT REFERENCES locations(id),
  purchase_date TEXT,
  purchase_cost REAL,
  warranty_end TEXT,
  current_firmware TEXT,
  last_update_date TEXT,
  image_url TEXT,
  notes TEXT,
  is_rental INTEGER DEFAULT 0,
  monthly_rate REAL,
  default_rental_rate REAL,
  default_billing_frequency TEXT DEFAULT 'monthly',
  rental_start_date TEXT,
  rented_to_client_id TEXT REFERENCES clients(id),
  next_invoice_date TEXT,
  assigned_client_id TEXT REFERENCES clients(id),
  assigned_job_id TEXT REFERENCES jobs(id),
  user_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Asset Documents
CREATE TABLE IF NOT EXISTS asset_documents (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT DEFAULT 'application/octet-stream',
  file_size INTEGER,
  uploaded_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Asset History
CREATE TABLE IF NOT EXISTS asset_history (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_date TEXT DEFAULT (date('now')),
  description TEXT NOT NULL,
  old_values TEXT,
  new_values TEXT,
  related_entity_type TEXT,
  related_entity_id TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Asset Maintenance
CREATE TABLE IF NOT EXISTS asset_maintenance (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  cost REAL,
  performed_by TEXT,
  next_due TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Asset Versions
CREATE TABLE IF NOT EXISTS asset_versions (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  update_date TEXT NOT NULL,
  release_notes TEXT,
  updated_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Job Assets (rentals)
CREATE TABLE IF NOT EXISTS job_assets (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES assets(id),
  rental_start_date TEXT NOT NULL,
  rental_end_date TEXT,
  rental_rate REAL NOT NULL,
  billing_frequency TEXT DEFAULT 'monthly',
  billing_day INTEGER DEFAULT 1,
  invoice_lead_days INTEGER DEFAULT 7,
  next_invoice_date TEXT,
  billing_in_advance INTEGER DEFAULT 1,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- INVENTORY
-- ============================================

-- Items
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  unit TEXT,
  unit_cost REAL,
  sales_price REAL,
  current_stock REAL DEFAULT 0,
  reorder_level REAL,
  image_url TEXT,
  vendor_id TEXT REFERENCES vendors(id),
  is_active INTEGER DEFAULT 1,
  user_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Inventory Movements
CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  movement_type TEXT CHECK(movement_type IN ('purchase', 'adjust', 'consume', 'return')) NOT NULL,
  quantity REAL NOT NULL,
  unit_cost REAL,
  job_id TEXT REFERENCES jobs(id),
  reference TEXT,
  notes TEXT,
  movement_date TEXT DEFAULT (date('now')),
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Item Price History
CREATE TABLE IF NOT EXISTS item_price_history (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  old_unit_cost REAL,
  new_unit_cost REAL,
  old_sales_price REAL,
  new_sales_price REAL,
  reason TEXT,
  changed_by TEXT,
  changed_at TEXT DEFAULT (datetime('now'))
);

-- Vendor Item Mappings
CREATE TABLE IF NOT EXISTS vendor_item_mappings (
  id TEXT PRIMARY KEY,
  vendor_id TEXT REFERENCES vendors(id),
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  vendor_item_name TEXT NOT NULL,
  quantity_multiplier REAL DEFAULT 1,
  notes TEXT,
  created_by TEXT,
  last_used_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- INVOICING & PAYMENTS
-- ============================================

-- Tax Rates
CREATE TABLE IF NOT EXISTS tax_rates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rate REAL NOT NULL,
  is_default INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  user_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL REFERENCES clients(id),
  job_id TEXT REFERENCES jobs(id),
  issue_date TEXT DEFAULT (date('now')),
  due_date TEXT NOT NULL,
  status TEXT CHECK(status IN ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'void', 'written_off')) DEFAULT 'draft',
  subtotal REAL DEFAULT 0,
  tax_total REAL DEFAULT 0,
  total REAL DEFAULT 0,
  amount_paid REAL DEFAULT 0,
  notes TEXT,
  terms TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Invoice Lines
CREATE TABLE IF NOT EXISTS invoice_lines (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity REAL DEFAULT 1,
  unit TEXT,
  unit_price REAL NOT NULL,
  line_total REAL NOT NULL,
  tax_rate REAL,
  tax_name TEXT,
  tax_rate_id TEXT REFERENCES tax_rates(id),
  account_id TEXT,
  item_id TEXT REFERENCES items(id),
  timesheet_id TEXT REFERENCES timesheets(id),
  expense_id TEXT REFERENCES expenses(id),
  job_asset_id TEXT REFERENCES job_assets(id),
  sort_order INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT,
  reference TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- PURCHASES & EXPENSES
-- ============================================

-- Purchases
CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  vendor_id TEXT REFERENCES vendors(id),
  vendor_name TEXT,
  date TEXT DEFAULT (date('now')),
  description TEXT NOT NULL,
  reference TEXT,
  amount REAL NOT NULL,
  tax_amount REAL DEFAULT 0,
  total REAL NOT NULL,
  payment_method TEXT,
  receipt_url TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Purchase Allocations
CREATE TABLE IF NOT EXISTS purchase_allocations (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  allocation_type TEXT NOT NULL,
  amount REAL NOT NULL,
  quantity REAL,
  description TEXT,
  item_id TEXT REFERENCES items(id),
  job_id TEXT REFERENCES jobs(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- BANKING
-- ============================================

-- Accounts (Chart of Accounts)
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('income', 'cogs', 'expense', 'asset', 'liability', 'equity')) NOT NULL,
  description TEXT,
  is_system INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  user_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Bank Accounts
CREATE TABLE IF NOT EXISTS bank_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  bank_name TEXT,
  bsb TEXT,
  account_number TEXT,
  account_id TEXT REFERENCES accounts(id),
  opening_balance REAL DEFAULT 0,
  opening_balance_date TEXT,
  current_balance REAL DEFAULT 0,
  is_default INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  user_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Bank Transactions
CREATE TABLE IF NOT EXISTS bank_transactions (
  id TEXT PRIMARY KEY,
  bank_account_id TEXT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  balance_after REAL,
  reference TEXT,
  is_reconciled INTEGER DEFAULT 0,
  reconciled_at TEXT,
  reconciled_by TEXT,
  matched_payment_id TEXT REFERENCES payments(id),
  matched_purchase_id TEXT REFERENCES purchases(id),
  import_batch_id TEXT,
  imported_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Journal Entries
CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  entry_date TEXT NOT NULL,
  description TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  is_system INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Journal Lines
CREATE TABLE IF NOT EXISTS journal_lines (
  id TEXT PRIMARY KEY,
  journal_entry_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  debit REAL,
  credit REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- ISSUES & SUPPORT
-- ============================================

-- Issues
CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK(status IN ('open', 'in_progress', 'resolved', 'closed')) DEFAULT 'open',
  severity TEXT CHECK(severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  client_id TEXT REFERENCES clients(id),
  job_id TEXT REFERENCES jobs(id),
  asset_id TEXT REFERENCES assets(id),
  vendor_id TEXT REFERENCES vendors(id),
  purchase_id TEXT REFERENCES purchases(id),
  assignee_id TEXT,
  due_date TEXT,
  first_response_date TEXT,
  resolved_at TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Issue Comments
CREATE TABLE IF NOT EXISTS issue_comments (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  user_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Issue Assets (many-to-many)
CREATE TABLE IF NOT EXISTS issue_assets (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES assets(id),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(issue_id, asset_id)
);

-- Issue Items (many-to-many)
CREATE TABLE IF NOT EXISTS issue_items (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(issue_id, item_id)
);

-- Issue Jobs (many-to-many)
CREATE TABLE IF NOT EXISTS issue_jobs (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(issue_id, job_id)
);

-- Issue Bookmarks
CREATE TABLE IF NOT EXISTS issue_bookmarks (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  bookmark_label TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Issue Bookmark Links
CREATE TABLE IF NOT EXISTS issue_bookmark_links (
  id TEXT PRIMARY KEY,
  source_issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  target_bookmark_id TEXT NOT NULL REFERENCES issue_bookmarks(id) ON DELETE CASCADE,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(source_issue_id, target_bookmark_id)
);

-- ============================================
-- KNOWLEDGE BASE
-- ============================================

-- KB Articles
CREATE TABLE IF NOT EXISTS kb_articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  content TEXT NOT NULL,
  summary TEXT,
  category TEXT,
  tags TEXT,
  status TEXT DEFAULT 'draft',
  view_count INTEGER DEFAULT 0,
  published_at TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- KB Attachments
CREATE TABLE IF NOT EXISTS kb_attachments (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- KB Article Issues
CREATE TABLE IF NOT EXISTS kb_article_issues (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  link_type TEXT DEFAULT 'reference',
  helped_resolve INTEGER DEFAULT 0,
  stage_notes TEXT,
  applied_by TEXT,
  applied_at TEXT DEFAULT (datetime('now')),
  UNIQUE(article_id, issue_id)
);

-- KB Article History
CREATE TABLE IF NOT EXISTS kb_article_history (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  description TEXT,
  old_values TEXT,
  new_values TEXT,
  changed_by TEXT,
  api_key_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- SETTINGS & CONFIGURATION
-- ============================================

-- Company Settings
CREATE TABLE IF NOT EXISTS company_settings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'My Company',
  trading_name TEXT,
  abn TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  favicon_url TEXT,
  app_name TEXT,
  currency TEXT DEFAULT 'AUD',
  currency_locale TEXT DEFAULT 'en-AU',
  default_tax_rate REAL DEFAULT 10,
  default_tax_rate_id TEXT REFERENCES tax_rates(id),
  default_payment_terms INTEGER DEFAULT 14,
  default_hourly_rate REAL DEFAULT 100,
  default_billable_time INTEGER DEFAULT 1,
  default_billable_expenses INTEGER DEFAULT 1,
  default_billing_in_advance INTEGER DEFAULT 1,
  default_role_id TEXT REFERENCES roles(id),
  invoice_prefix TEXT DEFAULT 'INV-',
  invoice_next_number INTEGER DEFAULT 1,
  job_prefix TEXT DEFAULT 'JOB-',
  job_next_number INTEGER DEFAULT 1,
  setup_completed INTEGER DEFAULT 0,
  user_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  scopes TEXT,
  is_active INTEGER DEFAULT 1,
  expires_at TEXT,
  last_used_at TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- API Request Log
CREATE TABLE IF NOT EXISTS api_request_log (
  id TEXT PRIMARY KEY,
  api_key_id TEXT REFERENCES api_keys(id),
  method TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  status_code INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  request_body TEXT,
  response_summary TEXT,
  duration_ms INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Activity Log
CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  entity_name TEXT,
  action TEXT NOT NULL,
  description TEXT,
  old_values TEXT,
  new_values TEXT,
  user_id TEXT,
  source TEXT DEFAULT 'browser',
  api_key_id TEXT REFERENCES api_keys(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Attachments (generic)
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER,
  uploaded_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Bill Import Sessions
CREATE TABLE IF NOT EXISTS bill_import_sessions (
  id TEXT PRIMARY KEY,
  vendor_id TEXT REFERENCES vendors(id),
  vendor_name TEXT,
  file_name TEXT,
  raw_data TEXT NOT NULL,
  column_mapping TEXT,
  matched_rows TEXT,
  total_amount REAL,
  status TEXT DEFAULT 'pending',
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_is_active ON clients(is_active);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_job_id ON timesheets(job_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_user_id ON timesheets(user_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_date ON timesheets(date);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_rental ON assets(is_rental, next_invoice_date);
CREATE INDEX IF NOT EXISTS idx_items_sku ON items(sku);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_item_id ON inventory_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_client_id ON issues(client_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_account_id ON bank_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_date ON bank_transactions(date);
