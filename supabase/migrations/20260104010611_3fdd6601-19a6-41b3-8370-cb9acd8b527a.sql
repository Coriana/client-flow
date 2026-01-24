-- Add movement_date column to track actual purchase date (separate from entry date)
ALTER TABLE public.inventory_movements 
ADD COLUMN movement_date date;

-- Backfill existing data with created_at date
UPDATE public.inventory_movements 
SET movement_date = created_at::date 
WHERE movement_date IS NULL;

-- Create index for efficient queries by movement_date
CREATE INDEX idx_inventory_movements_movement_date ON public.inventory_movements(item_id, movement_date DESC);