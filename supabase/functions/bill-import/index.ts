import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Fuzzy matching utilities (duplicated from src/lib/fuzzyMatch.ts for edge function)
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  
  if (m === 0) return n;
  if (n === 0) return m;
  
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  
  return dp[m][n];
}

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[\-\/\(\)]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(the|a|an)\b/gi, '')
    .trim();
}

function similarityScore(str1: string, str2: string): number {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  if (s1.includes(s2) || s2.includes(s1)) {
    const shorter = Math.min(s1.length, s2.length);
    const longer = Math.max(s1.length, s2.length);
    return 0.7 + (0.3 * shorter / longer);
  }
  
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  
  return Math.max(0, 1 - distance / maxLength);
}

function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category?: string | null;
  unit?: string | null;
  unit_cost?: number | null;
}

interface MatchResult {
  item_id: string;
  item_name: string;
  sku: string;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  unit?: string | null;
  unit_cost?: number | null;
}

interface SavedMapping {
  id: string;
  vendor_id: string | null;
  vendor_item_name: string;
  item_id: string;
  quantity_multiplier: number;
  item?: InventoryItem;
}

// Parse quantity patterns from item names like "Ctn-24", "6-pack", "x12", "dozen"
function parseQuantityMultiplier(itemName: string): { multiplier: number; detected: string | null } {
  const patterns = [
    { regex: /\bctn[\s\-\/]?(\d+)\b/i, group: 1 },           // Ctn-24, CTN 24, Carton/24
    { regex: /\bcarton[\s\-\/]?(\d+)\b/i, group: 1 },        // Carton-24
    { regex: /\b(\d+)[\s\-]?(?:pk|pack)\b/i, group: 1 },     // 6-pack, 6pk, 6 pack
    { regex: /\bx[\s]?(\d+)\b/i, group: 1 },                 // x12, x 24
    { regex: /\b(\d+)[\s\-]?(?:case|cs)\b/i, group: 1 },     // 24-case, 12cs
    { regex: /\bdozen\b/i, group: null, value: 12 },         // dozen
    { regex: /\bhalf[\s\-]?dozen\b/i, group: null, value: 6 }, // half-dozen
  ];

  for (const pattern of patterns) {
    const match = itemName.match(pattern.regex);
    if (match) {
      const multiplier = pattern.value ?? parseInt(match[pattern.group!], 10);
      if (multiplier > 1) {
        return { multiplier, detected: match[0] };
      }
    }
  }

  return { multiplier: 1, detected: null };
}

function findBestMatches(
  query: string,
  items: InventoryItem[],
  threshold: number = 0.4,
  maxResults: number = 5
): MatchResult[] {
  const results: { item: InventoryItem; score: number }[] = [];
  
  for (const item of items) {
    const skuScore = similarityScore(query, item.sku) * 1.5;
    const nameScore = similarityScore(query, item.name);
    const categoryScore = item.category ? similarityScore(query, item.category) * 0.3 : 0;
    
    let bestScore = Math.max(nameScore, skuScore, categoryScore);
    bestScore = Math.min(1, bestScore);
    
    if (bestScore >= threshold) {
      results.push({ item, score: bestScore });
    }
  }
  
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(r => ({
      item_id: r.item.id,
      item_name: r.item.name,
      sku: r.item.sku,
      score: r.score,
      confidence: getConfidenceLevel(r.score),
      unit: r.item.unit,
      unit_cost: r.item.unit_cost
    }));
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  // Expected paths: /bill-import or /bill-import/:id or /bill-import/:id/confirm
  const sessionId = pathParts[1] || null;
  const action = pathParts[2] || null;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get user from auth header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // POST /bill-import - Create new import session with fuzzy matching
    if (req.method === 'POST' && !sessionId) {
      const body = await req.json();
      const { vendor_id, vendor_name, csv_data, column_mapping, file_name } = body;

      if (!csv_data || !Array.isArray(csv_data) || csv_data.length < 2) {
        return new Response(JSON.stringify({ error: 'Invalid CSV data' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Fetch inventory items for matching
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('id, name, sku, category, unit, unit_cost')
        .eq('is_active', true);

      if (itemsError) throw itemsError;

      // Fetch saved vendor item mappings
      const { data: savedMappings, error: mappingsError } = await supabase
        .from('vendor_item_mappings')
        .select('id, vendor_id, vendor_item_name, item_id, quantity_multiplier')
        .or(vendor_id ? `vendor_id.eq.${vendor_id},vendor_id.is.null` : 'vendor_id.is.null');

      if (mappingsError) {
        console.warn('Could not fetch saved mappings:', mappingsError);
      }

      // Create lookup for saved mappings (vendor-specific takes priority over global)
      const mappingLookup = new Map<string, SavedMapping>();
      for (const mapping of (savedMappings || [])) {
        const key = mapping.vendor_item_name.toLowerCase().trim();
        const existing = mappingLookup.get(key);
        // Vendor-specific mappings take priority over global (null vendor_id)
        if (!existing || (mapping.vendor_id && !existing.vendor_id)) {
          mappingLookup.set(key, mapping);
        }
      }

      // Parse rows and run fuzzy matching
      const matchedRows = [];
      let totalAmount = 0;
      const headerRow = csv_data[0];
      
      // Track row-level vendor/location/date for aggregation
      const rowVendors: string[] = [];
      const rowLocations: string[] = [];
      const rowDates: string[] = [];
      
      for (let i = 1; i < csv_data.length; i++) {
        const row = csv_data[i];
        const mapping = column_mapping || {};
        
        const itemName = mapping.item_name !== undefined ? row[mapping.item_name] : row[0];
        const quantity = parseFloat(mapping.quantity !== undefined ? row[mapping.quantity] : row[1]) || 1;
        const unitPrice = parseFloat(mapping.unit_price !== undefined ? row[mapping.unit_price] : row[2]) || 0;
        const lineTotal = parseFloat(mapping.line_total !== undefined ? row[mapping.line_total] : row[3]) || (quantity * unitPrice);
        
        // Parse optional fields: vendor, location, date
        const rowVendor = mapping.vendor !== undefined ? row[mapping.vendor]?.trim() : null;
        const rowLocation = mapping.location !== undefined ? row[mapping.location]?.trim() : null;
        const rowDate = mapping.date !== undefined ? row[mapping.date]?.trim() : null;
        
        if (rowVendor) rowVendors.push(rowVendor);
        if (rowLocation) rowLocations.push(rowLocation);
        if (rowDate) rowDates.push(rowDate);

        totalAmount += lineTotal;

        // Check for saved mapping first
        const savedMapping = mappingLookup.get((itemName || '').toLowerCase().trim());
        
        // Parse quantity multiplier from item name
        const { multiplier: detectedMultiplier, detected: detectedPattern } = parseQuantityMultiplier(itemName || '');
        
        if (savedMapping) {
          // Use saved mapping - find the item details
          const mappedItem = items?.find(item => item.id === savedMapping.item_id);
          const effectiveQuantity = quantity * savedMapping.quantity_multiplier;
          const effectiveUnitPrice = lineTotal / effectiveQuantity;
          
          matchedRows.push({
            row_index: i,
            original: {
              item_name: itemName,
              quantity,
              unit_price: unitPrice,
              line_total: lineTotal,
              vendor: rowVendor,
              location: rowLocation,
              date: rowDate,
              raw: row
            },
            saved_mapping: {
              mapping_id: savedMapping.id,
              item_id: savedMapping.item_id,
              item_name: mappedItem?.name || 'Unknown Item',
              sku: mappedItem?.sku || '',
              quantity_multiplier: savedMapping.quantity_multiplier,
              effective_quantity: effectiveQuantity,
              effective_unit_price: effectiveUnitPrice
            },
            detected_quantity: detectedPattern ? { pattern: detectedPattern, multiplier: detectedMultiplier } : null,
            matches: mappedItem ? [{
              item_id: mappedItem.id,
              item_name: mappedItem.name,
              sku: mappedItem.sku,
              score: 1,
              confidence: 'high' as const,
              unit: mappedItem.unit,
              unit_cost: mappedItem.unit_cost
            }] : [],
            selected_match: { 
              item_id: savedMapping.item_id, 
              score: 1,
              from_saved_mapping: true,
              quantity_multiplier: savedMapping.quantity_multiplier
            },
            allocation_type: 'inventory_restock'
          });
        } else {
          // Run fuzzy matching
          const matches = findBestMatches(itemName || '', items || []);
          const highConfidenceMatch = matches.find(m => m.confidence === 'high');

          matchedRows.push({
            row_index: i,
            original: {
              item_name: itemName,
              quantity,
              unit_price: unitPrice,
              line_total: lineTotal,
              vendor: rowVendor,
              location: rowLocation,
              date: rowDate,
              raw: row
            },
            saved_mapping: null,
            detected_quantity: detectedPattern ? { pattern: detectedPattern, multiplier: detectedMultiplier } : null,
            matches,
            selected_match: highConfidenceMatch ? { 
              item_id: highConfidenceMatch.item_id, 
              score: highConfidenceMatch.score,
              quantity_multiplier: detectedMultiplier // Suggest detected multiplier
            } : null,
            allocation_type: highConfidenceMatch ? 'inventory_restock' : null
          });
        }
      }

      // Determine vendor/location/date from CSV if not provided in request
      const getMostCommon = (arr: string[]) => {
        if (arr.length === 0) return null;
        const counts = arr.reduce((acc, val) => {
          acc[val] = (acc[val] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
      };

      const csvVendorName = getMostCommon(rowVendors);
      const csvLocation = getMostCommon(rowLocations);
      const csvDate = getMostCommon(rowDates);

      // Use CSV-extracted values if not provided in request body
      const finalVendorName = vendor_name || csvVendorName;
      
      // Create session
      const { data: session, error: sessionError } = await supabase
        .from('bill_import_sessions')
        .insert({
          vendor_id,
          vendor_name: finalVendorName,
          file_name,
          raw_data: csv_data,
          column_mapping,
          matched_rows: matchedRows,
          status: 'matched',
          total_amount: totalAmount,
          created_by: user.id
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      const summary = {
        total_rows: matchedRows.length,
        high_confidence: matchedRows.filter(r => r.matches[0]?.confidence === 'high' || r.saved_mapping).length,
        medium_confidence: matchedRows.filter(r => !r.saved_mapping && r.matches[0]?.confidence === 'medium').length,
        low_confidence: matchedRows.filter(r => !r.saved_mapping && (r.matches[0]?.confidence === 'low' || r.matches.length === 0)).length,
        saved_mappings_used: matchedRows.filter(r => r.saved_mapping).length,
        total_amount: totalAmount
      };

      // Include extracted CSV metadata in response
      const extracted_metadata = {
        vendor_name: csvVendorName,
        location: csvLocation,
        date: csvDate
      };

      console.log(`Created bill import session ${session.id} with ${matchedRows.length} rows (${summary.saved_mappings_used} from saved mappings)`);

      return new Response(JSON.stringify({
        session_id: session.id,
        status: session.status,
        matched_rows: matchedRows,
        summary,
        extracted_metadata
      }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET /bill-import/:id - Get session details
    if (req.method === 'GET' && sessionId && !action) {
      const { data: session, error } = await supabase
        .from('bill_import_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error || !session) {
        return new Response(JSON.stringify({ error: 'Session not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify(session), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // PUT /bill-import/:id - Update match selections
    if (req.method === 'PUT' && sessionId && !action) {
      const body = await req.json();
      const { matched_rows: updatedRows } = body;

      // Get current session
      const { data: session, error: fetchError } = await supabase
        .from('bill_import_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (fetchError || !session) {
        return new Response(JSON.stringify({ error: 'Session not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Merge updates into existing matched_rows
      const currentRows = session.matched_rows as any[];
      for (const update of updatedRows) {
        const idx = currentRows.findIndex(r => r.row_index === update.row_index);
        if (idx !== -1) {
          if (update.selected_match !== undefined) {
            currentRows[idx].selected_match = update.selected_match;
          }
          if (update.allocation_type !== undefined) {
            currentRows[idx].allocation_type = update.allocation_type;
          }
          if (update.description !== undefined) {
            currentRows[idx].description = update.description;
          }
          if (update.create_new_item !== undefined) {
            currentRows[idx].create_new_item = update.create_new_item;
          }
          if (update.quantity_multiplier !== undefined) {
            currentRows[idx].selected_match = {
              ...currentRows[idx].selected_match,
              quantity_multiplier: update.quantity_multiplier
            };
          }
          if (update.save_mapping !== undefined) {
            currentRows[idx].save_mapping = update.save_mapping;
          }
        }
      }

      const { data: updated, error: updateError } = await supabase
        .from('bill_import_sessions')
        .update({ matched_rows: currentRows, updated_at: new Date().toISOString() })
        .eq('id', sessionId)
        .select()
        .single();

      if (updateError) throw updateError;

      console.log(`Updated bill import session ${sessionId}`);

      return new Response(JSON.stringify(updated), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /bill-import/:id/confirm - Finalize import
    if (req.method === 'POST' && sessionId && action === 'confirm') {
      const body = await req.json();
      const { date, payment_method, reference, bank_account_id, notes, location_id, save_mappings } = body;

      // Get session
      const { data: session, error: fetchError } = await supabase
        .from('bill_import_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (fetchError || !session) {
        return new Response(JSON.stringify({ error: 'Session not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (session.status === 'completed') {
        return new Response(JSON.stringify({ error: 'Session already completed' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const matchedRows = session.matched_rows as any[];
      
      // Extract date from CSV if not provided
      const csvDates = matchedRows
        .map(r => r.original?.date)
        .filter(Boolean);
      const csvDate = csvDates.length > 0 ? csvDates[0] : null;
      
      // Parse and validate the date - try various formats
      const parseDate = (dateStr: string | null): string => {
        if (!dateStr) return new Date().toISOString().split('T')[0];
        
        // Try to parse the date string
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0];
        }
        
        // Try DD/MM/YYYY format (common in AU)
        const ddmmyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (ddmmyyyy) {
          const [, day, month, year] = ddmmyyyy;
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        
        return new Date().toISOString().split('T')[0];
      };
      
      const finalDate = parseDate(date || csvDate);
      
      // Create items for rows marked as create_new_item
      const newItemIds: Record<number, string> = {};
      for (const row of matchedRows) {
        if (row.create_new_item) {
          const { data: newItem, error: itemError } = await supabase
            .from('items')
            .insert({
              name: row.original.item_name,
              sku: row.create_new_item.sku || `SKU-${Date.now()}-${row.row_index}`,
              unit: row.create_new_item.unit || 'each',
              unit_cost: row.original.unit_price,
              current_stock: 0,
              is_active: true,
              user_id: user.id
            })
            .select()
            .single();

          if (itemError) throw itemError;
          newItemIds[row.row_index] = newItem.id;
          row.selected_match = { item_id: newItem.id, quantity_multiplier: row.selected_match?.quantity_multiplier || 1 };
          row.allocation_type = 'inventory_restock';
        }
      }

      // Create purchase record
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          vendor_id: session.vendor_id,
          date: finalDate,
          amount: session.total_amount,
          total: session.total_amount,
          payment_method: payment_method || 'other',
          reference,
          notes,
          description: `Bill import: ${session.file_name || 'CSV Import'}`,
          created_by: user.id
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // Create allocations and update inventory
      let allocationsCreated = 0;
      let inventoryUpdated = 0;
      let mappingsSaved = 0;

      for (const row of matchedRows) {
        const quantityMultiplier = row.selected_match?.quantity_multiplier || row.saved_mapping?.quantity_multiplier || 1;
        const effectiveQuantity = row.original.quantity * quantityMultiplier;
        const effectiveUnitPrice = row.original.line_total / effectiveQuantity;

        if (row.allocation_type === 'inventory_restock' && row.selected_match?.item_id) {
          // Create inventory restock allocation
          const { error: allocError } = await supabase
            .from('purchase_allocations')
            .insert({
              purchase_id: purchase.id,
              allocation_type: 'inventory_restock',
              item_id: row.selected_match.item_id,
              quantity: effectiveQuantity,
              amount: row.original.line_total,
              description: row.original.item_name
            });

          if (allocError) throw allocError;
          allocationsCreated++;

          // Update inventory stock
          const { data: item } = await supabase
            .from('items')
            .select('current_stock, unit_cost')
            .eq('id', row.selected_match.item_id)
            .single();

          if (item) {
            const newStock = (item.current_stock || 0) + effectiveQuantity;
            const purchaseUnitCost = effectiveUnitPrice;

            // Log inventory movement first (with movement_date for proper WAC calculation)
            await supabase
              .from('inventory_movements')
              .insert({
                item_id: row.selected_match.item_id,
                movement_type: 'purchase',
                quantity: effectiveQuantity,
                unit_cost: purchaseUnitCost,
                movement_date: finalDate,
                reference: `Purchase ${purchase.id}`,
                notes: quantityMultiplier > 1 
                  ? `Bill import from ${session.file_name || 'CSV'} (${row.original.quantity} x ${quantityMultiplier} multiplier)`
                  : `Bill import from ${session.file_name || 'CSV'}`,
                created_by: user.id
              });

            // Calculate weighted average cost from recent purchases
            const { data: recentPurchases } = await supabase
              .from('inventory_movements')
              .select('quantity, unit_cost')
              .eq('item_id', row.selected_match.item_id)
              .eq('movement_type', 'purchase')
              .order('movement_date', { ascending: false, nullsFirst: false })
              .order('created_at', { ascending: false })
              .limit(5);

            let weightedAvgCost = purchaseUnitCost;
            if (recentPurchases && recentPurchases.length > 0) {
              let totalValue = 0;
              let totalQuantity = 0;
              for (const p of recentPurchases) {
                totalValue += (p.quantity || 0) * (p.unit_cost || 0);
                totalQuantity += p.quantity || 0;
              }
              weightedAvgCost = totalQuantity > 0 ? totalValue / totalQuantity : purchaseUnitCost;
            }

            // Check if price change is significant (>$0.01 AND >1%)
            const oldCost = item.unit_cost || 0;
            const priceDiff = Math.abs(oldCost - weightedAvgCost);
            const percentDiff = oldCost > 0 ? (priceDiff / oldCost) * 100 : 100;
            const significantChange = priceDiff >= 0.01 && percentDiff >= 1;

            // Update stock, and unit cost only if significant change
            await supabase
              .from('items')
              .update({ 
                current_stock: newStock,
                ...(significantChange ? { unit_cost: weightedAvgCost } : {})
              })
              .eq('id', row.selected_match.item_id);

            // Log price history only if cost changed significantly
            if (significantChange) {
              await supabase
                .from('item_price_history')
                .insert({
                  item_id: row.selected_match.item_id,
                  old_unit_cost: item.unit_cost,
                  new_unit_cost: weightedAvgCost,
                  reason: 'Bill import restock (weighted avg)',
                  changed_by: user.id
                });
            }

            inventoryUpdated++;
          }

          // Save mapping if requested and not already from a saved mapping
          const shouldSaveMapping = save_mappings !== false && 
            !row.saved_mapping && 
            row.save_mapping !== false &&
            row.original.item_name;

          if (shouldSaveMapping) {
            // Check if mapping already exists
            const { data: existingMapping } = await supabase
              .from('vendor_item_mappings')
              .select('id')
              .eq('vendor_item_name', row.original.item_name)
              .eq('vendor_id', session.vendor_id)
              .maybeSingle();

            if (!existingMapping) {
              const { error: mappingError } = await supabase
                .from('vendor_item_mappings')
                .insert({
                  vendor_id: session.vendor_id,
                  vendor_item_name: row.original.item_name,
                  item_id: row.selected_match.item_id,
                  quantity_multiplier: quantityMultiplier,
                  created_by: user.id
                });

              if (!mappingError) {
                mappingsSaved++;
                console.log(`Saved mapping: "${row.original.item_name}" -> item ${row.selected_match.item_id} (x${quantityMultiplier})`);
              }
            }
          }
        } else if (row.allocation_type === 'general') {
          // Create general expense allocation
          const { error: allocError } = await supabase
            .from('purchase_allocations')
            .insert({
              purchase_id: purchase.id,
              allocation_type: 'general',
              amount: row.original.line_total,
              description: row.description || row.original.item_name
            });

          if (allocError) throw allocError;
          allocationsCreated++;
        }
      }

      // Update session status
      await supabase
        .from('bill_import_sessions')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', sessionId);

      console.log(`Completed bill import session ${sessionId}: purchase ${purchase.id}, ${allocationsCreated} allocations, ${inventoryUpdated} inventory updates, ${mappingsSaved} new mappings saved`);

      return new Response(JSON.stringify({
        purchase_id: purchase.id,
        allocations_created: allocationsCreated,
        inventory_updated: inventoryUpdated,
        mappings_saved: mappingsSaved,
        total: session.total_amount
      }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // DELETE /bill-import/:id - Cancel/delete session
    if (req.method === 'DELETE' && sessionId) {
      const { error } = await supabase
        .from('bill_import_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      console.log(`Deleted bill import session ${sessionId}`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET /bill-import - List all sessions
    if (req.method === 'GET' && !sessionId) {
      const { data: sessions, error } = await supabase
        .from('bill_import_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify(sessions), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    const error = err as Error;
    console.error('Bill import error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
