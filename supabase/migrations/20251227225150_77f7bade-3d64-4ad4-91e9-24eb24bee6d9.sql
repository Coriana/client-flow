-- Add billing details to trading_names table
ALTER TABLE public.trading_names 
ADD COLUMN IF NOT EXISTS bank_name text,
ADD COLUMN IF NOT EXISTS bank_bsb text,
ADD COLUMN IF NOT EXISTS bank_account_number text,
ADD COLUMN IF NOT EXISTS bank_account_name text,
ADD COLUMN IF NOT EXISTS paypal_email text,
ADD COLUMN IF NOT EXISTS other_payment_details text;

-- Add billable defaults to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS default_billable_time boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS default_billable_expenses boolean DEFAULT false;