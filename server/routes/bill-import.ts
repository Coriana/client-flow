import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute, transaction } from '../db/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
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

function parseQuantityMultiplier(itemName: string): { multiplier: number; detected: string | null } {
  const patterns = [
    { regex: /\bctn[\s\-\/]?(\d+)\b/i, group: 1 },
    { regex: /\bcarton[\s\-\/]?(\d+)\b/i, group: 1 },
    { regex: /\b(\d+)[\s\-]?(?:pk|pack)\b/i, group: 1 },
    { regex: /\bx[\s]?(\d+)\b/i, group: 1 },
    { regex: /\b(\d+)[\s\-]?(?:case|cs)\b/i, group: 1 },
    { regex: /\bdozen\b/i, group: null, value: 12 },
    { regex: /\bhalf[\s\-]?dozen\b/i, group: null, value: 6 },
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

function findBestMatches(query: string, items: any[], threshold = 0.4, maxResults = 5) {
  const results: { item: any; score: number }[] = [];

  for (const item of items) {
    const skuScore = similarityScore(query, item.sku || '') * 1.5;
    const nameScore = similarityScore(query, item.name || '');
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
      unit_cost: r.item.unit_cost,
    }));
}

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { vendor_id, vendor_name, csv_data, column_mapping, file_name } = req.body;

  if (!csv_data || !Array.isArray(csv_data) || csv_data.length < 2) {
    res.status(400).json({ error: 'Invalid CSV data' });
    return;
  }

  const items = queryAll<any>('SELECT id, name, sku, category, unit, unit_cost FROM items WHERE is_active = 1').data || [];

  const mappingsQuery = vendor_id
    ? queryAll<any>(
        'SELECT id, vendor_id, vendor_item_name, item_id, quantity_multiplier FROM vendor_item_mappings WHERE vendor_id = ? OR vendor_id IS NULL',
        [vendor_id]
      )
    : queryAll<any>('SELECT id, vendor_id, vendor_item_name, item_id, quantity_multiplier FROM vendor_item_mappings WHERE vendor_id IS NULL');

  const savedMappings = mappingsQuery.data || [];
  const mappingLookup = new Map<string, any>();
  savedMappings.forEach(mapping => {
    const key = mapping.vendor_item_name.toLowerCase().trim();
    const existing = mappingLookup.get(key);
    if (!existing || (mapping.vendor_id && !existing.vendor_id)) {
      mappingLookup.set(key, mapping);
    }
  });

  const matchedRows: any[] = [];
  let totalAmount = 0;
  const rowVendors: string[] = [];
  const rowLocations: string[] = [];
  const rowDates: string[] = [];

  for (let i = 1; i < csv_data.length; i++) {
    const row = csv_data[i];
    const mapping = column_mapping || {};

    const itemName = mapping.item_name !== undefined ? row[mapping.item_name] : row[0];
    const quantity = parseFloat(mapping.quantity !== undefined ? row[mapping.quantity] : row[1]) || 1;
    const unitPrice = parseFloat(mapping.unit_price !== undefined ? row[mapping.unit_price] : row[2]) || 0;
    const lineTotal = parseFloat(mapping.line_total !== undefined ? row[mapping.line_total] : row[3]) || quantity * unitPrice;

    const rowVendor = mapping.vendor !== undefined ? row[mapping.vendor]?.trim() : null;
    const rowLocation = mapping.location !== undefined ? row[mapping.location]?.trim() : null;
    const rowDate = mapping.date !== undefined ? row[mapping.date]?.trim() : null;

    if (rowVendor) rowVendors.push(rowVendor);
    if (rowLocation) rowLocations.push(rowLocation);
    if (rowDate) rowDates.push(rowDate);

    totalAmount += lineTotal;

    const savedMapping = mappingLookup.get((itemName || '').toLowerCase().trim());
    const { multiplier: detectedMultiplier, detected: detectedPattern } = parseQuantityMultiplier(itemName || '');

    if (savedMapping) {
      const mappedItem = items.find(item => item.id === savedMapping.item_id);
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
          raw: row,
        },
        saved_mapping: {
          mapping_id: savedMapping.id,
          item_id: savedMapping.item_id,
          item_name: mappedItem?.name || 'Unknown Item',
          sku: mappedItem?.sku || '',
          quantity_multiplier: savedMapping.quantity_multiplier,
          effective_quantity: effectiveQuantity,
          effective_unit_price: effectiveUnitPrice,
        },
        detected_quantity: detectedPattern ? { pattern: detectedPattern, multiplier: detectedMultiplier } : null,
        matches: mappedItem
          ? [
              {
                item_id: mappedItem.id,
                item_name: mappedItem.name,
                sku: mappedItem.sku,
                score: 1,
                confidence: 'high' as const,
                unit: mappedItem.unit,
                unit_cost: mappedItem.unit_cost,
              },
            ]
          : [],
        selected_match: {
          item_id: savedMapping.item_id,
          score: 1,
          from_saved_mapping: true,
          quantity_multiplier: savedMapping.quantity_multiplier,
        },
        allocation_type: 'inventory_restock',
      });
    } else {
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
          raw: row,
        },
        saved_mapping: null,
        detected_quantity: detectedPattern ? { pattern: detectedPattern, multiplier: detectedMultiplier } : null,
        matches,
        selected_match: highConfidenceMatch
          ? {
              item_id: highConfidenceMatch.item_id,
              score: highConfidenceMatch.score,
              quantity_multiplier: detectedMultiplier,
            }
          : null,
        allocation_type: highConfidenceMatch ? 'inventory_restock' : null,
      });
    }
  }

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

  const finalVendorName = vendor_name || csvVendorName;
  const sessionId = uuidv4();

  execute(
    `INSERT INTO bill_import_sessions (id, vendor_id, vendor_name, file_name, raw_data, column_mapping, matched_rows, status, total_amount, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      vendor_id || null,
      finalVendorName || null,
      file_name || null,
      JSON.stringify(csv_data),
      column_mapping ? JSON.stringify(column_mapping) : null,
      JSON.stringify(matchedRows),
      'matched',
      totalAmount,
      req.user?.id || null,
    ]
  );

  const summary = {
    total_rows: matchedRows.length,
    high_confidence: matchedRows.filter(r => r.matches[0]?.confidence === 'high' || r.saved_mapping).length,
    medium_confidence: matchedRows.filter(r => !r.saved_mapping && r.matches[0]?.confidence === 'medium').length,
    low_confidence: matchedRows.filter(r => !r.saved_mapping && (r.matches[0]?.confidence === 'low' || r.matches.length === 0)).length,
    saved_mappings_used: matchedRows.filter(r => r.saved_mapping).length,
    total_amount: totalAmount,
  };

  res.status(201).json({
    session_id: sessionId,
    status: 'matched',
    matched_rows: matchedRows,
    summary,
    extracted_metadata: {
      vendor_name: csvVendorName,
      location: csvLocation,
      date: csvDate,
    },
  });
});

router.get('/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const session = queryOne<any>('SELECT * FROM bill_import_sessions WHERE id = ?', [id]).data;
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json({
    ...session,
    raw_data: session.raw_data ? JSON.parse(session.raw_data) : null,
    column_mapping: session.column_mapping ? JSON.parse(session.column_mapping) : null,
    matched_rows: session.matched_rows ? JSON.parse(session.matched_rows) : [],
  });
});

router.put('/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { matched_rows: updatedRows } = req.body;
  const session = queryOne<any>('SELECT * FROM bill_import_sessions WHERE id = ?', [id]).data;
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const currentRows = session.matched_rows ? JSON.parse(session.matched_rows) : [];
  updatedRows.forEach((update: any) => {
    const idx = currentRows.findIndex((row: any) => row.row_index === update.row_index);
    if (idx !== -1) {
      if (update.selected_match !== undefined) currentRows[idx].selected_match = update.selected_match;
      if (update.allocation_type !== undefined) currentRows[idx].allocation_type = update.allocation_type;
      if (update.description !== undefined) currentRows[idx].description = update.description;
      if (update.create_new_item !== undefined) currentRows[idx].create_new_item = update.create_new_item;
      if (update.quantity_multiplier !== undefined) {
        currentRows[idx].selected_match = {
          ...currentRows[idx].selected_match,
          quantity_multiplier: update.quantity_multiplier,
        };
      }
      if (update.save_mapping !== undefined) currentRows[idx].save_mapping = update.save_mapping;
    }
  });

  execute('UPDATE bill_import_sessions SET matched_rows = ?, updated_at = ? WHERE id = ?', [
    JSON.stringify(currentRows),
    new Date().toISOString(),
    id,
  ]);

  res.json({
    ...session,
    matched_rows: currentRows,
  });
});

router.post('/:id/confirm', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { save_mappings } = req.body;

  const session = queryOne<any>('SELECT * FROM bill_import_sessions WHERE id = ?', [id]).data;
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  if (session.status === 'completed') {
    res.status(400).json({ error: 'Session already completed' });
    return;
  }

  const matchedRows = session.matched_rows ? JSON.parse(session.matched_rows) : [];

  // Only save vendor item mappings here - don't create purchase or allocations
  // The MakePaymentDialog will handle creating the actual purchase when user clicks Save
  const result = transaction(() => {
    let mappingsSaved = 0;

    matchedRows.forEach((row: any) => {
      const quantityMultiplier = row.selected_match?.quantity_multiplier || row.saved_mapping?.quantity_multiplier || 1;

      if (row.allocation_type === 'inventory_restock' && row.selected_match?.item_id) {
        const shouldSaveMapping = save_mappings !== false && !row.saved_mapping && row.save_mapping !== false && row.original.item_name;
        if (shouldSaveMapping) {
          const existing = queryOne<any>(
            'SELECT id FROM vendor_item_mappings WHERE vendor_item_name = ? AND vendor_id IS ? LIMIT 1',
            [row.original.item_name, session.vendor_id || null]
          ).data;

          if (!existing) {
            execute(
              `INSERT INTO vendor_item_mappings (id, vendor_id, vendor_item_name, item_id, quantity_multiplier, created_by)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                uuidv4(),
                session.vendor_id || null,
                row.original.item_name,
                row.selected_match.item_id,
                quantityMultiplier,
                req.user?.id || null,
              ]
            );
            mappingsSaved++;
          }
        }
      }
    });

    execute('UPDATE bill_import_sessions SET status = ?, updated_at = ? WHERE id = ?', [
      'completed',
      new Date().toISOString(),
      id,
    ]);

    return { mappingsSaved };
  });

  res.status(200).json({
    mappings_saved: result.mappingsSaved,
    total: session.total_amount,
    message: 'Import confirmed. Allocations staged for save.'
  });
});

router.delete('/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  execute('DELETE FROM bill_import_sessions WHERE id = ?', [id]);
  res.json({ success: true });
});

router.get('/', authMiddleware, (req: AuthRequest, res: Response) => {
  const sessions = queryAll<any>('SELECT * FROM bill_import_sessions ORDER BY created_at DESC').data || [];
  res.json(sessions.map(session => ({
    ...session,
    raw_data: session.raw_data ? JSON.parse(session.raw_data) : null,
    column_mapping: session.column_mapping ? JSON.parse(session.column_mapping) : null,
    matched_rows: session.matched_rows ? JSON.parse(session.matched_rows) : [],
  })));
});

export default router;
