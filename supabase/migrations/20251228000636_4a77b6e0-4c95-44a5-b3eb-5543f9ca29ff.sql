-- Add purchase_id to issues table for linking issues to purchases
ALTER TABLE public.issues ADD COLUMN purchase_id uuid REFERENCES public.purchases(id);

-- Create issue_items junction table for linking issues to inventory items
CREATE TABLE public.issue_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(issue_id, item_id)
);

-- Enable RLS
ALTER TABLE public.issue_items ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "All can view issue_items" ON public.issue_items
  FOR SELECT USING (true);

CREATE POLICY "Staff can manage issue_items" ON public.issue_items
  FOR ALL USING (NOT has_role(auth.uid(), 'readonly'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_issues_purchase_id ON public.issues(purchase_id);
CREATE INDEX idx_issues_vendor_id ON public.issues(vendor_id);
CREATE INDEX idx_issue_items_issue_id ON public.issue_items(issue_id);
CREATE INDEX idx_issue_items_item_id ON public.issue_items(item_id);