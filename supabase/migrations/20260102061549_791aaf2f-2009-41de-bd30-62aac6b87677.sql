-- Update RLS policies to use permission-based access instead of user_id scoping
-- This converts to single-tenant where all authenticated users share data based on their role permissions

-- CLIENTS
DROP POLICY IF EXISTS "Users can view own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can manage own clients" ON public.clients;
CREATE POLICY "Users can view clients" ON public.clients FOR SELECT TO authenticated USING (can_read('clients'));
CREATE POLICY "Users can insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (can_write('clients'));
CREATE POLICY "Users can update clients" ON public.clients FOR UPDATE TO authenticated USING (can_write('clients'));
CREATE POLICY "Users can delete clients" ON public.clients FOR DELETE TO authenticated USING (can_write('clients'));

-- CLIENT_CONTACTS
DROP POLICY IF EXISTS "Users can view own client contacts" ON public.client_contacts;
DROP POLICY IF EXISTS "Users can manage own client contacts" ON public.client_contacts;
CREATE POLICY "Users can view client contacts" ON public.client_contacts FOR SELECT TO authenticated USING (can_read('clients'));
CREATE POLICY "Users can insert client contacts" ON public.client_contacts FOR INSERT TO authenticated WITH CHECK (can_write('clients'));
CREATE POLICY "Users can update client contacts" ON public.client_contacts FOR UPDATE TO authenticated USING (can_write('clients'));
CREATE POLICY "Users can delete client contacts" ON public.client_contacts FOR DELETE TO authenticated USING (can_write('clients'));

-- CLIENT_CONTACT_HISTORY
DROP POLICY IF EXISTS "Users can view own client contact history" ON public.client_contact_history;
DROP POLICY IF EXISTS "Users can insert own client contact history" ON public.client_contact_history;
CREATE POLICY "Users can view client contact history" ON public.client_contact_history FOR SELECT TO authenticated USING (can_read('clients'));
CREATE POLICY "Users can insert client contact history" ON public.client_contact_history FOR INSERT TO authenticated WITH CHECK (can_write('clients'));

-- JOBS
DROP POLICY IF EXISTS "Users can view own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can manage own jobs" ON public.jobs;
CREATE POLICY "Users can view jobs" ON public.jobs FOR SELECT TO authenticated USING (can_read('jobs'));
CREATE POLICY "Users can insert jobs" ON public.jobs FOR INSERT TO authenticated WITH CHECK (can_write('jobs'));
CREATE POLICY "Users can update jobs" ON public.jobs FOR UPDATE TO authenticated USING (can_write('jobs'));
CREATE POLICY "Users can delete jobs" ON public.jobs FOR DELETE TO authenticated USING (can_write('jobs'));

-- JOB_ASSETS
DROP POLICY IF EXISTS "Users can view own job_assets" ON public.job_assets;
DROP POLICY IF EXISTS "Users can manage own job_assets" ON public.job_assets;
CREATE POLICY "Users can view job_assets" ON public.job_assets FOR SELECT TO authenticated USING (can_read('jobs'));
CREATE POLICY "Users can insert job_assets" ON public.job_assets FOR INSERT TO authenticated WITH CHECK (can_write('jobs'));
CREATE POLICY "Users can update job_assets" ON public.job_assets FOR UPDATE TO authenticated USING (can_write('jobs'));
CREATE POLICY "Users can delete job_assets" ON public.job_assets FOR DELETE TO authenticated USING (can_write('jobs'));

-- JOB_ASSIGNMENTS
DROP POLICY IF EXISTS "Users can view own job assignments" ON public.job_assignments;
DROP POLICY IF EXISTS "Users can manage own job assignments" ON public.job_assignments;
CREATE POLICY "Users can view job assignments" ON public.job_assignments FOR SELECT TO authenticated USING (can_read('jobs'));
CREATE POLICY "Users can insert job assignments" ON public.job_assignments FOR INSERT TO authenticated WITH CHECK (can_write('jobs'));
CREATE POLICY "Users can update job assignments" ON public.job_assignments FOR UPDATE TO authenticated USING (can_write('jobs'));
CREATE POLICY "Users can delete job assignments" ON public.job_assignments FOR DELETE TO authenticated USING (can_write('jobs'));

-- INVOICES
DROP POLICY IF EXISTS "Users can view own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can manage own invoices" ON public.invoices;
CREATE POLICY "Users can view invoices" ON public.invoices FOR SELECT TO authenticated USING (can_read('invoices'));
CREATE POLICY "Users can insert invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (can_write('invoices'));
CREATE POLICY "Users can update invoices" ON public.invoices FOR UPDATE TO authenticated USING (can_write('invoices'));
CREATE POLICY "Users can delete invoices" ON public.invoices FOR DELETE TO authenticated USING (can_write('invoices'));

-- INVOICE_LINES
DROP POLICY IF EXISTS "Users can view own invoice lines" ON public.invoice_lines;
DROP POLICY IF EXISTS "Users can manage own invoice lines" ON public.invoice_lines;
CREATE POLICY "Users can view invoice lines" ON public.invoice_lines FOR SELECT TO authenticated USING (can_read('invoices'));
CREATE POLICY "Users can insert invoice lines" ON public.invoice_lines FOR INSERT TO authenticated WITH CHECK (can_write('invoices'));
CREATE POLICY "Users can update invoice lines" ON public.invoice_lines FOR UPDATE TO authenticated USING (can_write('invoices'));
CREATE POLICY "Users can delete invoice lines" ON public.invoice_lines FOR DELETE TO authenticated USING (can_write('invoices'));

-- PAYMENTS
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can manage own payments" ON public.payments;
CREATE POLICY "Users can view payments" ON public.payments FOR SELECT TO authenticated USING (can_read('payments'));
CREATE POLICY "Users can insert payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (can_write('payments'));
CREATE POLICY "Users can update payments" ON public.payments FOR UPDATE TO authenticated USING (can_write('payments'));
CREATE POLICY "Users can delete payments" ON public.payments FOR DELETE TO authenticated USING (can_write('payments'));

-- VENDORS
DROP POLICY IF EXISTS "Users can view own vendors" ON public.vendors;
DROP POLICY IF EXISTS "Users can manage own vendors" ON public.vendors;
CREATE POLICY "Users can view vendors" ON public.vendors FOR SELECT TO authenticated USING (can_read('vendors'));
CREATE POLICY "Users can insert vendors" ON public.vendors FOR INSERT TO authenticated WITH CHECK (can_write('vendors'));
CREATE POLICY "Users can update vendors" ON public.vendors FOR UPDATE TO authenticated USING (can_write('vendors'));
CREATE POLICY "Users can delete vendors" ON public.vendors FOR DELETE TO authenticated USING (can_write('vendors'));

-- VENDOR_CONTACTS
DROP POLICY IF EXISTS "Users can view own vendor contacts" ON public.vendor_contacts;
DROP POLICY IF EXISTS "Users can manage own vendor contacts" ON public.vendor_contacts;
CREATE POLICY "Users can view vendor contacts" ON public.vendor_contacts FOR SELECT TO authenticated USING (can_read('vendors'));
CREATE POLICY "Users can insert vendor contacts" ON public.vendor_contacts FOR INSERT TO authenticated WITH CHECK (can_write('vendors'));
CREATE POLICY "Users can update vendor contacts" ON public.vendor_contacts FOR UPDATE TO authenticated USING (can_write('vendors'));
CREATE POLICY "Users can delete vendor contacts" ON public.vendor_contacts FOR DELETE TO authenticated USING (can_write('vendors'));

-- PURCHASES
DROP POLICY IF EXISTS "Users can view own purchases" ON public.purchases;
DROP POLICY IF EXISTS "Users can manage own purchases" ON public.purchases;
CREATE POLICY "Users can view purchases" ON public.purchases FOR SELECT TO authenticated USING (can_read('purchases'));
CREATE POLICY "Users can insert purchases" ON public.purchases FOR INSERT TO authenticated WITH CHECK (can_write('purchases'));
CREATE POLICY "Users can update purchases" ON public.purchases FOR UPDATE TO authenticated USING (can_write('purchases'));
CREATE POLICY "Users can delete purchases" ON public.purchases FOR DELETE TO authenticated USING (can_write('purchases'));

-- PURCHASE_ALLOCATIONS
DROP POLICY IF EXISTS "Users can view own purchase allocations" ON public.purchase_allocations;
DROP POLICY IF EXISTS "Users can manage own purchase allocations" ON public.purchase_allocations;
CREATE POLICY "Users can view purchase allocations" ON public.purchase_allocations FOR SELECT TO authenticated USING (can_read('purchases'));
CREATE POLICY "Users can insert purchase allocations" ON public.purchase_allocations FOR INSERT TO authenticated WITH CHECK (can_write('purchases'));
CREATE POLICY "Users can update purchase allocations" ON public.purchase_allocations FOR UPDATE TO authenticated USING (can_write('purchases'));
CREATE POLICY "Users can delete purchase allocations" ON public.purchase_allocations FOR DELETE TO authenticated USING (can_write('purchases'));

-- ITEMS
DROP POLICY IF EXISTS "Users can view own items" ON public.items;
DROP POLICY IF EXISTS "Users can manage own items" ON public.items;
CREATE POLICY "Users can view items" ON public.items FOR SELECT TO authenticated USING (can_read('items'));
CREATE POLICY "Users can insert items" ON public.items FOR INSERT TO authenticated WITH CHECK (can_write('items'));
CREATE POLICY "Users can update items" ON public.items FOR UPDATE TO authenticated USING (can_write('items'));
CREATE POLICY "Users can delete items" ON public.items FOR DELETE TO authenticated USING (can_write('items'));

-- ITEM_PRICE_HISTORY
DROP POLICY IF EXISTS "Users can view own price history" ON public.item_price_history;
DROP POLICY IF EXISTS "Users can manage own price history" ON public.item_price_history;
CREATE POLICY "Users can view price history" ON public.item_price_history FOR SELECT TO authenticated USING (can_read('items'));
CREATE POLICY "Users can insert price history" ON public.item_price_history FOR INSERT TO authenticated WITH CHECK (can_write('items'));
CREATE POLICY "Users can update price history" ON public.item_price_history FOR UPDATE TO authenticated USING (can_write('items'));
CREATE POLICY "Users can delete price history" ON public.item_price_history FOR DELETE TO authenticated USING (can_write('items'));

-- INVENTORY_MOVEMENTS
DROP POLICY IF EXISTS "Users can view own inventory movements" ON public.inventory_movements;
DROP POLICY IF EXISTS "Users can manage own inventory movements" ON public.inventory_movements;
CREATE POLICY "Users can view inventory movements" ON public.inventory_movements FOR SELECT TO authenticated USING (can_read('items'));
CREATE POLICY "Users can insert inventory movements" ON public.inventory_movements FOR INSERT TO authenticated WITH CHECK (can_write('items'));
CREATE POLICY "Users can update inventory movements" ON public.inventory_movements FOR UPDATE TO authenticated USING (can_write('items'));
CREATE POLICY "Users can delete inventory movements" ON public.inventory_movements FOR DELETE TO authenticated USING (can_write('items'));

-- ASSETS
DROP POLICY IF EXISTS "Users can view own assets" ON public.assets;
DROP POLICY IF EXISTS "Users can manage own assets" ON public.assets;
CREATE POLICY "Users can view assets" ON public.assets FOR SELECT TO authenticated USING (can_read('assets'));
CREATE POLICY "Users can insert assets" ON public.assets FOR INSERT TO authenticated WITH CHECK (can_write('assets'));
CREATE POLICY "Users can update assets" ON public.assets FOR UPDATE TO authenticated USING (can_write('assets'));
CREATE POLICY "Users can delete assets" ON public.assets FOR DELETE TO authenticated USING (can_write('assets'));

-- ASSET_HISTORY
DROP POLICY IF EXISTS "Users can view own asset history" ON public.asset_history;
DROP POLICY IF EXISTS "Users can manage own asset history" ON public.asset_history;
CREATE POLICY "Users can view asset history" ON public.asset_history FOR SELECT TO authenticated USING (can_read('assets'));
CREATE POLICY "Users can insert asset history" ON public.asset_history FOR INSERT TO authenticated WITH CHECK (can_write('assets'));
CREATE POLICY "Users can update asset history" ON public.asset_history FOR UPDATE TO authenticated USING (can_write('assets'));
CREATE POLICY "Users can delete asset history" ON public.asset_history FOR DELETE TO authenticated USING (can_write('assets'));

-- ASSET_MAINTENANCE
DROP POLICY IF EXISTS "Users can view own asset maintenance" ON public.asset_maintenance;
DROP POLICY IF EXISTS "Users can manage own asset maintenance" ON public.asset_maintenance;
CREATE POLICY "Users can view asset maintenance" ON public.asset_maintenance FOR SELECT TO authenticated USING (can_read('assets'));
CREATE POLICY "Users can insert asset maintenance" ON public.asset_maintenance FOR INSERT TO authenticated WITH CHECK (can_write('assets'));
CREATE POLICY "Users can update asset maintenance" ON public.asset_maintenance FOR UPDATE TO authenticated USING (can_write('assets'));
CREATE POLICY "Users can delete asset maintenance" ON public.asset_maintenance FOR DELETE TO authenticated USING (can_write('assets'));

-- ASSET_VERSIONS
DROP POLICY IF EXISTS "Users can view own asset versions" ON public.asset_versions;
DROP POLICY IF EXISTS "Users can manage own asset versions" ON public.asset_versions;
CREATE POLICY "Users can view asset versions" ON public.asset_versions FOR SELECT TO authenticated USING (can_read('assets'));
CREATE POLICY "Users can insert asset versions" ON public.asset_versions FOR INSERT TO authenticated WITH CHECK (can_write('assets'));
CREATE POLICY "Users can update asset versions" ON public.asset_versions FOR UPDATE TO authenticated USING (can_write('assets'));
CREATE POLICY "Users can delete asset versions" ON public.asset_versions FOR DELETE TO authenticated USING (can_write('assets'));

-- ISSUES
DROP POLICY IF EXISTS "Users can view own issues" ON public.issues;
DROP POLICY IF EXISTS "Users can manage own issues" ON public.issues;
CREATE POLICY "Users can view issues" ON public.issues FOR SELECT TO authenticated USING (can_read('issues'));
CREATE POLICY "Users can insert issues" ON public.issues FOR INSERT TO authenticated WITH CHECK (can_write('issues'));
CREATE POLICY "Users can update issues" ON public.issues FOR UPDATE TO authenticated USING (can_write('issues'));
CREATE POLICY "Users can delete issues" ON public.issues FOR DELETE TO authenticated USING (can_write('issues'));

-- ISSUE_ASSETS
DROP POLICY IF EXISTS "Users can view own issue_assets" ON public.issue_assets;
DROP POLICY IF EXISTS "Users can manage own issue_assets" ON public.issue_assets;
CREATE POLICY "Users can view issue_assets" ON public.issue_assets FOR SELECT TO authenticated USING (can_read('issues'));
CREATE POLICY "Users can insert issue_assets" ON public.issue_assets FOR INSERT TO authenticated WITH CHECK (can_write('issues'));
CREATE POLICY "Users can update issue_assets" ON public.issue_assets FOR UPDATE TO authenticated USING (can_write('issues'));
CREATE POLICY "Users can delete issue_assets" ON public.issue_assets FOR DELETE TO authenticated USING (can_write('issues'));

-- ISSUE_COMMENTS
DROP POLICY IF EXISTS "Users can view own issue comments" ON public.issue_comments;
DROP POLICY IF EXISTS "Users can add own issue comments" ON public.issue_comments;
CREATE POLICY "Users can view issue comments" ON public.issue_comments FOR SELECT TO authenticated USING (can_read('issues'));
CREATE POLICY "Users can insert issue comments" ON public.issue_comments FOR INSERT TO authenticated WITH CHECK (can_write('issues'));
CREATE POLICY "Users can update issue comments" ON public.issue_comments FOR UPDATE TO authenticated USING (can_write('issues'));
CREATE POLICY "Users can delete issue comments" ON public.issue_comments FOR DELETE TO authenticated USING (can_write('issues'));

-- ISSUE_ITEMS
DROP POLICY IF EXISTS "Users can view own issue_items" ON public.issue_items;
DROP POLICY IF EXISTS "Users can manage own issue_items" ON public.issue_items;
CREATE POLICY "Users can view issue_items" ON public.issue_items FOR SELECT TO authenticated USING (can_read('issues'));
CREATE POLICY "Users can insert issue_items" ON public.issue_items FOR INSERT TO authenticated WITH CHECK (can_write('issues'));
CREATE POLICY "Users can update issue_items" ON public.issue_items FOR UPDATE TO authenticated USING (can_write('issues'));
CREATE POLICY "Users can delete issue_items" ON public.issue_items FOR DELETE TO authenticated USING (can_write('issues'));

-- ISSUE_JOBS
DROP POLICY IF EXISTS "Users can view own issue_jobs" ON public.issue_jobs;
DROP POLICY IF EXISTS "Users can manage own issue_jobs" ON public.issue_jobs;
CREATE POLICY "Users can view issue_jobs" ON public.issue_jobs FOR SELECT TO authenticated USING (can_read('issues'));
CREATE POLICY "Users can insert issue_jobs" ON public.issue_jobs FOR INSERT TO authenticated WITH CHECK (can_write('issues'));
CREATE POLICY "Users can update issue_jobs" ON public.issue_jobs FOR UPDATE TO authenticated USING (can_write('issues'));
CREATE POLICY "Users can delete issue_jobs" ON public.issue_jobs FOR DELETE TO authenticated USING (can_write('issues'));

-- TIMESHEETS
DROP POLICY IF EXISTS "Users can view own timesheets" ON public.timesheets;
DROP POLICY IF EXISTS "Users can manage own timesheets" ON public.timesheets;
CREATE POLICY "Users can view timesheets" ON public.timesheets FOR SELECT TO authenticated USING (can_read('timesheets'));
CREATE POLICY "Users can insert timesheets" ON public.timesheets FOR INSERT TO authenticated WITH CHECK (can_write('timesheets'));
CREATE POLICY "Users can update timesheets" ON public.timesheets FOR UPDATE TO authenticated USING (can_write('timesheets'));
CREATE POLICY "Users can delete timesheets" ON public.timesheets FOR DELETE TO authenticated USING (can_write('timesheets'));

-- EXPENSES
DROP POLICY IF EXISTS "Users can view own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can manage own expenses" ON public.expenses;
CREATE POLICY "Users can view expenses" ON public.expenses FOR SELECT TO authenticated USING (can_read('expenses'));
CREATE POLICY "Users can insert expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (can_write('expenses'));
CREATE POLICY "Users can update expenses" ON public.expenses FOR UPDATE TO authenticated USING (can_write('expenses'));
CREATE POLICY "Users can delete expenses" ON public.expenses FOR DELETE TO authenticated USING (can_write('expenses'));

-- ACCOUNTS
DROP POLICY IF EXISTS "Users can view own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can manage own accounts" ON public.accounts;
CREATE POLICY "Users can view accounts" ON public.accounts FOR SELECT TO authenticated USING (can_read('settings'));
CREATE POLICY "Users can insert accounts" ON public.accounts FOR INSERT TO authenticated WITH CHECK (can_write('settings'));
CREATE POLICY "Users can update accounts" ON public.accounts FOR UPDATE TO authenticated USING (can_write('settings'));
CREATE POLICY "Users can delete accounts" ON public.accounts FOR DELETE TO authenticated USING (can_write('settings'));

-- TAX_RATES
DROP POLICY IF EXISTS "Users can view own tax rates" ON public.tax_rates;
DROP POLICY IF EXISTS "Users can manage own tax rates" ON public.tax_rates;
CREATE POLICY "Users can view tax rates" ON public.tax_rates FOR SELECT TO authenticated USING (can_read('settings'));
CREATE POLICY "Users can insert tax rates" ON public.tax_rates FOR INSERT TO authenticated WITH CHECK (can_write('settings'));
CREATE POLICY "Users can update tax rates" ON public.tax_rates FOR UPDATE TO authenticated USING (can_write('settings'));
CREATE POLICY "Users can delete tax rates" ON public.tax_rates FOR DELETE TO authenticated USING (can_write('settings'));

-- TRADING_NAMES
DROP POLICY IF EXISTS "Users can view own trading names" ON public.trading_names;
DROP POLICY IF EXISTS "Users can manage own trading names" ON public.trading_names;
CREATE POLICY "Users can view trading names" ON public.trading_names FOR SELECT TO authenticated USING (can_read('settings'));
CREATE POLICY "Users can insert trading names" ON public.trading_names FOR INSERT TO authenticated WITH CHECK (can_write('settings'));
CREATE POLICY "Users can update trading names" ON public.trading_names FOR UPDATE TO authenticated USING (can_write('settings'));
CREATE POLICY "Users can delete trading names" ON public.trading_names FOR DELETE TO authenticated USING (can_write('settings'));

-- COMPANY_SETTINGS
DROP POLICY IF EXISTS "Users can view own company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Users can manage own company settings" ON public.company_settings;
CREATE POLICY "Users can view company settings" ON public.company_settings FOR SELECT TO authenticated USING (can_read('settings'));
CREATE POLICY "Users can insert company settings" ON public.company_settings FOR INSERT TO authenticated WITH CHECK (can_write('settings'));
CREATE POLICY "Users can update company settings" ON public.company_settings FOR UPDATE TO authenticated USING (can_write('settings'));
CREATE POLICY "Users can delete company settings" ON public.company_settings FOR DELETE TO authenticated USING (can_write('settings'));

-- JOURNAL_ENTRIES
DROP POLICY IF EXISTS "Users can view own journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can insert own journal entries" ON public.journal_entries;
CREATE POLICY "Users can view journal entries" ON public.journal_entries FOR SELECT TO authenticated USING (can_read('settings'));
CREATE POLICY "Users can insert journal entries" ON public.journal_entries FOR INSERT TO authenticated WITH CHECK (can_write('settings'));

-- JOURNAL_LINES
DROP POLICY IF EXISTS "Users can view own journal lines" ON public.journal_lines;
DROP POLICY IF EXISTS "Users can insert own journal lines" ON public.journal_lines;
CREATE POLICY "Users can view journal lines" ON public.journal_lines FOR SELECT TO authenticated USING (can_read('settings'));
CREATE POLICY "Users can insert journal lines" ON public.journal_lines FOR INSERT TO authenticated WITH CHECK (can_write('settings'));

-- ACTIVITY_LOG
DROP POLICY IF EXISTS "Users can view own activity log" ON public.activity_log;
DROP POLICY IF EXISTS "Users can insert activity log" ON public.activity_log;
CREATE POLICY "Users can view activity log" ON public.activity_log FOR SELECT TO authenticated USING (can_read('settings'));
CREATE POLICY "Users can insert activity log" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (true);

-- ATTACHMENTS
DROP POLICY IF EXISTS "Users can view own attachments" ON public.attachments;
DROP POLICY IF EXISTS "Users can manage own attachments" ON public.attachments;
CREATE POLICY "Users can view attachments" ON public.attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert attachments" ON public.attachments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update attachments" ON public.attachments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete attachments" ON public.attachments FOR DELETE TO authenticated USING (true);

-- USER_ROLES - Update to use can_write('team') for management
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Users can view user roles" ON public.user_roles FOR SELECT TO authenticated USING (can_read('team'));
CREATE POLICY "Users can insert user roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (can_write('team'));
CREATE POLICY "Users can update user roles" ON public.user_roles FOR UPDATE TO authenticated USING (can_write('team'));
CREATE POLICY "Users can delete user roles" ON public.user_roles FOR DELETE TO authenticated USING (can_write('team'));

-- PROFILES - Everyone can view, only update own
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update profiles" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id OR can_write('team'));