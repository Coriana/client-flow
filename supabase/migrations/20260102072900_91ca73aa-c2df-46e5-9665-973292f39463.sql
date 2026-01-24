-- Create bank_accounts table
CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  account_id uuid REFERENCES accounts(id),
  bank_name text,
  bsb text,
  account_number text,
  opening_balance numeric DEFAULT 0,
  opening_balance_date date,
  current_balance numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  user_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create bank_transactions table
CREATE TABLE public.bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL,
  reference text,
  balance_after numeric,
  matched_payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  matched_purchase_id uuid REFERENCES purchases(id) ON DELETE SET NULL,
  is_reconciled boolean DEFAULT false,
  reconciled_at timestamptz,
  reconciled_by uuid,
  import_batch_id uuid,
  imported_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Add banking resource
INSERT INTO public.resources (name, display_name, category, sort_order)
VALUES ('banking', 'Banking', 'Finance', 15);

-- Add banking permissions to existing roles
INSERT INTO public.role_permissions (role_id, resource_id, permission)
SELECT r.id, res.id, 
  CASE 
    WHEN r.name IN ('owner', 'admin') THEN 'write'::permission_level
    WHEN r.name = 'staff' THEN 'read'::permission_level
    ELSE 'none'::permission_level
  END
FROM public.roles r
CROSS JOIN public.resources res
WHERE res.name = 'banking';

-- Enable RLS
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for bank_accounts
CREATE POLICY "Users can view bank accounts" ON public.bank_accounts
  FOR SELECT USING (can_read('banking'));

CREATE POLICY "Users can insert bank accounts" ON public.bank_accounts
  FOR INSERT WITH CHECK (can_write('banking'));

CREATE POLICY "Users can update bank accounts" ON public.bank_accounts
  FOR UPDATE USING (can_write('banking'));

CREATE POLICY "Users can delete bank accounts" ON public.bank_accounts
  FOR DELETE USING (can_write('banking'));

-- RLS policies for bank_transactions
CREATE POLICY "Users can view bank transactions" ON public.bank_transactions
  FOR SELECT USING (can_read('banking'));

CREATE POLICY "Users can insert bank transactions" ON public.bank_transactions
  FOR INSERT WITH CHECK (can_write('banking'));

CREATE POLICY "Users can update bank transactions" ON public.bank_transactions
  FOR UPDATE USING (can_write('banking'));

CREATE POLICY "Users can delete bank transactions" ON public.bank_transactions
  FOR DELETE USING (can_write('banking'));

-- Add updated_at trigger for bank_accounts
CREATE TRIGGER update_bank_accounts_updated_at
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Create indexes for performance
CREATE INDEX idx_bank_transactions_account ON public.bank_transactions(bank_account_id);
CREATE INDEX idx_bank_transactions_date ON public.bank_transactions(date DESC);
CREATE INDEX idx_bank_transactions_reconciled ON public.bank_transactions(is_reconciled);