import { supabase } from "@/integrations/supabase/client";

// Price tolerance thresholds
const MIN_PRICE_DIFF = 0.01; // Minimum absolute difference to consider significant
const MIN_PERCENT_DIFF = 1; // Minimum percentage difference to consider significant

/**
 * Check if a price change is significant enough to log
 */
export function isPriceChangeSignificant(oldCost: number, newCost: number): boolean {
  if (oldCost === 0 && newCost === 0) return false;
  if (oldCost === 0) return newCost >= MIN_PRICE_DIFF;
  
  const priceDiff = Math.abs(oldCost - newCost);
  const percentDiff = (priceDiff / oldCost) * 100;
  
  return priceDiff >= MIN_PRICE_DIFF && percentDiff >= MIN_PERCENT_DIFF;
}

/**
 * Calculate weighted average unit cost from recent purchases
 * Uses actual movement_date (or created_at as fallback) for ordering
 */
export async function calculateWeightedAverageCost(
  itemId: string,
  newPurchaseQuantity: number,
  newPurchaseUnitCost: number,
  purchaseDate?: string,
  purchasesToInclude: number = 5
): Promise<number> {
  // Fetch recent purchase movements ordered by date
  const { data: recentPurchases, error } = await supabase
    .from('inventory_movements')
    .select('quantity, unit_cost, movement_date, created_at')
    .eq('item_id', itemId)
    .eq('movement_type', 'purchase')
    .order('movement_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(purchasesToInclude);

  if (error || !recentPurchases || recentPurchases.length === 0) {
    // No previous purchases, return the new purchase cost
    return newPurchaseUnitCost;
  }

  // Calculate weighted average including the new purchase
  let totalValue = newPurchaseQuantity * newPurchaseUnitCost;
  let totalQuantity = newPurchaseQuantity;

  for (const purchase of recentPurchases) {
    const qty = purchase.quantity || 0;
    const cost = purchase.unit_cost || 0;
    totalValue += qty * cost;
    totalQuantity += qty;
  }

  return totalQuantity > 0 ? totalValue / totalQuantity : newPurchaseUnitCost;
}

/**
 * Update item unit cost using weighted average calculation
 * Only logs price change if significant
 */
export async function updateItemCostWithWAC(
  itemId: string,
  currentUnitCost: number,
  purchaseQuantity: number,
  purchaseUnitCost: number,
  purchaseDate: string,
  reason: string,
  userId?: string
): Promise<{ newCost: number; priceChanged: boolean }> {
  // Calculate weighted average cost
  const weightedAvgCost = await calculateWeightedAverageCost(
    itemId,
    purchaseQuantity,
    purchaseUnitCost,
    purchaseDate
  );

  // Check if change is significant
  const priceChanged = isPriceChangeSignificant(currentUnitCost, weightedAvgCost);

  if (priceChanged) {
    // Update item with new weighted average cost
    await supabase
      .from('items')
      .update({ unit_cost: weightedAvgCost })
      .eq('id', itemId);

    // Log price change
    await supabase.from('item_price_history').insert({
      item_id: itemId,
      old_unit_cost: currentUnitCost,
      new_unit_cost: weightedAvgCost,
      reason,
      changed_by: userId || null,
    });
  }

  return { newCost: weightedAvgCost, priceChanged };
}
