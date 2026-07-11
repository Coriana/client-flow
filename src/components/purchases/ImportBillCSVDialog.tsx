import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, ArrowLeft, ArrowRight, Check, AlertCircle, Bookmark, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useBranding } from '@/contexts/BrandingContext';
import { todayLocal } from '@/lib/dates';

interface ImportBillCSVDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (allocations: ImportedAllocation[]) => void;
  vendorId?: string;
  vendorName?: string;
}

export interface ImportedAllocation {
  type: 'inventory_restock' | 'general';
  item_id?: string;
  quantity?: number;
  amount: number;
  description?: string;
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

interface MatchedRow {
  row_index: number;
  original: {
    item_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    vendor?: string | null;
    location?: string | null;
    date?: string | null;
    raw: string[];
  };
  saved_mapping: {
    mapping_id: string;
    item_id: string;
    item_name: string;
    sku: string;
    quantity_multiplier: number;
    effective_quantity: number;
    effective_unit_price: number;
  } | null;
  detected_quantity: { pattern: string; multiplier: number } | null;
  matches: MatchResult[];
  selected_match: { 
    item_id: string; 
    score: number;
    from_saved_mapping?: boolean;
    quantity_multiplier?: number;
  } | null;
  allocation_type: 'inventory_restock' | 'general' | null;
}

interface ApiSession {
  id: string;
  matched_rows: MatchedRow[];
  total_amount: number;
  summary: {
    total_rows: number;
    high_confidence: number;
    medium_confidence: number;
    low_confidence: number;
    saved_mappings_used: number;
    total_amount: number;
  };
}

type Step = 'upload' | 'mapping' | 'matching' | 'confirm';

const COLUMN_OPTIONS = [
  { value: 'item_name', label: 'Item Name/Description' },
  { value: 'quantity', label: 'Quantity' },
  { value: 'unit_price', label: 'Unit Price' },
  { value: 'line_total', label: 'Line Total' },
  { value: 'sku', label: 'SKU/Code' },
  { value: 'skip', label: 'Skip Column' },
];

function getConfidenceColor(score: number): string {
  if (score >= 0.8) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  if (score >= 0.5) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
}

export default function ImportBillCSVDialog({ 
  open, 
  onOpenChange, 
  onImport,
  vendorId,
  vendorName 
}: ImportBillCSVDialogProps) {
  const { toast } = useToast();
  const { formatCurrency } = useBranding();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<Step>('upload');
  const [rawData, setRawData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [hasHeaderRow, setHasHeaderRow] = useState(true);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  
  // API-based state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [matchedRows, setMatchedRows] = useState<MatchedRow[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [inventoryItems, setInventoryItems] = useState<{ id: string; name: string; sku: string }[]>([]);
  
  // Track which rows should save their mapping
  const [saveMapping, setSaveMapping] = useState<Record<number, boolean>>({});
  // Track custom quantity multipliers (overrides detected/saved)
  const [quantityMultipliers, setQuantityMultipliers] = useState<Record<number, number>>({});

  useEffect(() => {
    if (open) {
      fetchInventoryItems();
      resetState();
    }
  }, [open]);

  function resetState() {
    setStep('upload');
    setRawData([]);
    setHeaders([]);
    setColumnMapping({});
    setHasHeaderRow(true);
    setSessionId(null);
    setMatchedRows([]);
    setTotalAmount(0);
    setSaveMapping({});
    setQuantityMultipliers({});
    setFileName('');
  }

  async function fetchInventoryItems() {
    const { data } = await supabase
      .from('items')
      .select('id, name, sku')
      .eq('is_active', true)
      .order('name');
    
    setInventoryItems(data || []);
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      const parsed = lines.map(line => {
        const values: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim());
        return values;
      });
      
      setRawData(parsed);
      if (parsed.length > 0) {
        setHeaders(parsed[0]);
        autoDetectColumns(parsed[0]);
      }
      setStep('mapping');
    };
    reader.readAsText(file);
  }

  function autoDetectColumns(headerRow: string[]) {
    const mapping: Record<string, string> = {};
    
    headerRow.forEach((header, index) => {
      const h = header.toLowerCase();
      const colKey = `col_${index}`;
      
      if (h.includes('description') || h.includes('item') || h.includes('name') || h.includes('product')) {
        mapping[colKey] = 'item_name';
      } else if (h.includes('qty') || h.includes('quantity')) {
        mapping[colKey] = 'quantity';
      } else if (h.includes('unit') && h.includes('price')) {
        mapping[colKey] = 'unit_price';
      } else if (h.includes('total') || h.includes('amount')) {
        mapping[colKey] = 'line_total';
      } else if (h.includes('sku') || h.includes('code')) {
        mapping[colKey] = 'sku';
      } else {
        mapping[colKey] = 'skip';
      }
    });
    
    setColumnMapping(mapping);
  }

  async function proceedToMatching() {
    // Validate required columns
    const itemNameCol = Object.entries(columnMapping).find(([_, v]) => v === 'item_name')?.[0];
    const quantityCol = Object.entries(columnMapping).find(([_, v]) => v === 'quantity')?.[0];
    const lineTotalCol = Object.entries(columnMapping).find(([_, v]) => v === 'line_total')?.[0];
    
    if (!itemNameCol) {
      toast({ title: 'Error', description: 'Please map the Item Name column', variant: 'destructive' });
      return;
    }
    
    if (!quantityCol && !lineTotalCol) {
      toast({ title: 'Error', description: 'Please map at least Quantity or Line Total', variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      // Build column mapping for API (convert col_X to index)
      const getColIndex = (col: string | undefined) => col ? parseInt(col.replace('col_', '')) : undefined;
      
      const apiColumnMapping: Record<string, number | undefined> = {};
      Object.entries(columnMapping).forEach(([key, value]) => {
        if (value !== 'skip') {
          apiColumnMapping[value] = getColIndex(key);
        }
      });

      // Call the bill-import API
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/bill-import`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            vendor_id: vendorId,
            vendor_name: vendorName,
            csv_data: hasHeaderRow ? rawData : [headers, ...rawData],
            column_mapping: apiColumnMapping,
            file_name: fileName,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process import');
      }

      const result = await response.json();
      
      setSessionId(result.session_id);
      setMatchedRows(result.matched_rows);
      setTotalAmount(result.summary.total_amount);
      
      // Initialize save mapping for rows without saved mappings
      const initialSaveMapping: Record<number, boolean> = {};
      const initialMultipliers: Record<number, number> = {};
      
      result.matched_rows.forEach((row) => {
        // Default: save new mappings when user confirms
        if (!row.saved_mapping && row.selected_match) {
          initialSaveMapping[row.row_index] = true;
        }
        // Set quantity multiplier from saved mapping, detected pattern, or 1
        const multiplier = row.saved_mapping?.quantity_multiplier 
          || row.selected_match?.quantity_multiplier 
          || row.detected_quantity?.multiplier 
          || 1;
        initialMultipliers[row.row_index] = multiplier;
      });
      
      setSaveMapping(initialSaveMapping);
      setQuantityMultipliers(initialMultipliers);
      
      setStep('matching');
    } catch (error) {
      console.error('Error processing import:', error);
      toast({ 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to process import', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  }

  function updateMatchedRow(rowIndex: number, updates: Partial<MatchedRow>) {
    setMatchedRows(rows => rows.map(r => 
      r.row_index === rowIndex ? { ...r, ...updates } : r
    ));
  }

  function acceptAllHighConfidence() {
    setMatchedRows(rows => rows.map(row => {
      const bestMatch = row.matches[0];
      if (bestMatch && bestMatch.score >= 0.8) {
        return {
          ...row,
          selected_match: { 
            item_id: bestMatch.item_id, 
            score: bestMatch.score,
            quantity_multiplier: quantityMultipliers[row.row_index] || 1
          },
          allocation_type: 'inventory_restock',
        };
      }
      return row;
    }));
  }

  async function handleConfirm() {
    if (!sessionId) {
      toast({ title: 'Error', description: 'No import session found', variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      // Build updated rows with current selections and multipliers
      const updatedRows = matchedRows.map(row => ({
        row_index: row.row_index,
        selected_item_id: row.allocation_type === 'inventory_restock' && row.selected_match 
          ? row.selected_match.item_id 
          : null,
        allocation_type: row.allocation_type || 'general',
        quantity_multiplier: quantityMultipliers[row.row_index] || 1,
        save_mapping: saveMapping[row.row_index] || false,
      }));

      // Update the session with current selections
      const { data: { session } } = await supabase.auth.getSession();
      
      const updateResponse = await fetch(
        `${import.meta.env.VITE_API_URL}/bill-import/${sessionId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ matched_rows: updatedRows }),
        }
      );

      if (!updateResponse.ok) {
        const error = await updateResponse.json();
        throw new Error(error.error || 'Failed to update selections');
      }

      // Confirm the import
      const confirmResponse = await fetch(
        `${import.meta.env.VITE_API_URL}/bill-import/${sessionId}/confirm`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ 
            save_mappings: true,
            date: todayLocal()
          }),
        }
      );

      if (!confirmResponse.ok) {
        const error = await confirmResponse.json();
        throw new Error(error.error || 'Failed to confirm import');
      }

      const result = await confirmResponse.json();

      // Build allocations for the parent component
      const allocations: ImportedAllocation[] = matchedRows.map(row => {
        const multiplier = quantityMultipliers[row.row_index] || 1;
        const effectiveQuantity = row.original.quantity * multiplier;
        
        if (row.allocation_type === 'inventory_restock' && row.selected_match) {
          return {
            type: 'inventory_restock',
            item_id: row.selected_match.item_id,
            quantity: effectiveQuantity,
            amount: row.original.line_total,
          };
        } else {
          return {
            type: 'general',
            amount: row.original.line_total,
            description: row.original.item_name,
          };
        }
      });

      // Count saved mappings from the API result
      const savedCount = result.mappings_saved || 0;
      
      toast({ 
        title: 'Import Ready', 
        description: `${allocations.length} items staged${savedCount > 0 ? `, ${savedCount} mappings saved for future use` : ''}. Click Save to record payment.`
      });
      
      onImport(allocations);
      onOpenChange(false);
    } catch (error) {
      console.error('Error confirming import:', error);
      toast({ 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to confirm import', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  }

  const inventoryCount = matchedRows.filter(r => r.allocation_type === 'inventory_restock' && r.selected_match).length;
  const generalCount = matchedRows.filter(r => r.allocation_type === 'general' || !r.selected_match).length;
  const savedMappingsCount = matchedRows.filter(r => r.saved_mapping).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-4">
            Import Supplier Bill
            <Badge variant="outline" className="font-normal">
              Step {step === 'upload' ? 1 : step === 'mapping' ? 2 : step === 'matching' ? 3 : 4}/4
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4 py-8">
            <div className="flex flex-col items-center justify-center gap-4 border-2 border-dashed rounded-lg p-12">
              <Upload className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <p className="text-lg font-medium">Upload CSV File</p>
                <p className="text-sm text-muted-foreground">
                  Import supplier invoice or bill as CSV
                </p>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".csv"
                className="hidden"
              />
              <Button onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Select CSV File
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === 'mapping' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox 
                id="hasHeader"
                checked={hasHeaderRow}
                onCheckedChange={(checked) => setHasHeaderRow(!!checked)}
              />
              <Label htmlFor="hasHeader">First row contains column headers</Label>
            </div>
            
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted px-4 py-2 font-medium text-sm">
                Map columns to fields
              </div>
              <div className="p-4 space-y-3">
                {headers.map((header, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className="w-48 text-sm truncate font-mono bg-muted px-2 py-1 rounded">
                      {header || `Column ${index + 1}`}
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Select
                      value={columnMapping[`col_${index}`] || 'skip'}
                      onValueChange={(v) => setColumnMapping({ ...columnMapping, [`col_${index}`]: v })}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COLUMN_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Preview */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted px-4 py-2 font-medium text-sm">
                Preview (first 3 data rows)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {(hasHeaderRow ? rawData.slice(1, 4) : rawData.slice(0, 3)).map((row, idx) => (
                      <tr key={idx} className="border-b">
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} className="px-4 py-2 truncate max-w-[150px]">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Matching */}
        {step === 'matching' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {savedMappingsCount > 0 && (
                  <span className="text-green-600 mr-3">
                    <Bookmark className="h-3 w-3 inline mr-1" />
                    {savedMappingsCount} saved mappings applied
                  </span>
                )}
                Review matches and adjust as needed
              </div>
              <Button variant="outline" size="sm" onClick={acceptAllHighConfidence}>
                <Check className="h-4 w-4 mr-1" />
                Accept All High-Confidence
              </Button>
            </div>
            
            <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
              {matchedRows.map((row) => {
                const bestMatch = row.matches[0];
                const multiplier = quantityMultipliers[row.row_index] || 1;
                const effectiveQty = row.original.quantity * multiplier;
                const effectiveUnitPrice = row.original.line_total / effectiveQty;
                
                return (
                  <div key={row.row_index} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{row.original.item_name}</p>
                          {row.saved_mapping && (
                            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              <Bookmark className="h-3 w-3 mr-1" />
                              Saved
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Qty: {row.original.quantity}
                          {multiplier > 1 && (
                            <span className="text-blue-600 ml-1">
                              × {multiplier} = {effectiveQty} units
                              {row.detected_quantity && (
                                <span className="text-xs ml-1">({row.detected_quantity.pattern} detected)</span>
                              )}
                            </span>
                          )}
                          {' '}@ {formatCurrency(effectiveUnitPrice)}/unit = {formatCurrency(row.original.line_total)}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">{formatCurrency(row.original.line_total)}</Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 flex-wrap">
                      <Select
                        value={row.selected_match?.item_id || (row.allocation_type === 'general' ? '__general__' : '__select__')}
                        onValueChange={(v) => {
                          if (v === '__general__') {
                            updateMatchedRow(row.row_index, { selected_match: null, allocation_type: 'general' });
                          } else {
                            const item = inventoryItems.find(i => i.id === v);
                            updateMatchedRow(row.row_index, { 
                              selected_match: { item_id: v, score: 1, quantity_multiplier: multiplier },
                              allocation_type: 'inventory_restock' 
                            });
                          }
                        }}
                      >
                        <SelectTrigger className="w-[280px]">
                          <SelectValue placeholder="Select inventory item..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__general__">
                            <span className="text-muted-foreground">Record as General Expense</span>
                          </SelectItem>
                          {row.matches.length > 0 && (
                            <>
                              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                                Suggested Matches
                              </div>
                              {row.matches.map(match => (
                                <SelectItem key={match.item_id} value={match.item_id}>
                                  <div className="flex items-center gap-2">
                                    <span>{match.sku} - {match.item_name}</span>
                                    <Badge className={getConfidenceColor(match.score)} variant="secondary">
                                      {Math.round(match.score * 100)}%
                                    </Badge>
                                  </div>
                                </SelectItem>
                              ))}
                            </>
                          )}
                          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                            All Items
                          </div>
                          {inventoryItems.map(item => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.sku} - {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {/* Quantity Multiplier Input */}
                      {row.allocation_type === 'inventory_restock' && row.selected_match && (
                        <div className="flex items-center gap-1">
                          <Label className="text-xs text-muted-foreground">×</Label>
                          <Input 
                            type="number"
                            min="1"
                            step="1"
                            value={multiplier}
                            onChange={(e) => setQuantityMultipliers(prev => ({
                              ...prev,
                              [row.row_index]: parseInt(e.target.value) || 1
                            }))}
                            className="w-16 h-8 text-sm"
                          />
                        </div>
                      )}
                      
                      {bestMatch && row.selected_match && !row.saved_mapping && (
                        <Badge className={getConfidenceColor(bestMatch.score)}>
                          {Math.round(bestMatch.score * 100)}% match
                        </Badge>
                      )}
                      
                      {row.allocation_type === 'general' && (
                        <Badge variant="secondary">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          General Expense
                        </Badge>
                      )}
                    </div>
                    
                    {/* Save Mapping Checkbox - only for new mappings */}
                    {row.allocation_type === 'inventory_restock' && row.selected_match && !row.saved_mapping && (
                      <div className="flex items-center gap-2 pt-1">
                        <Checkbox 
                          id={`save-${row.row_index}`}
                          checked={saveMapping[row.row_index] || false}
                          onCheckedChange={(checked) => setSaveMapping(prev => ({
                            ...prev,
                            [row.row_index]: !!checked
                          }))}
                        />
                        <Label htmlFor={`save-${row.row_index}`} className="text-xs text-muted-foreground cursor-pointer">
                          Remember this mapping for future imports
                          {multiplier > 1 && ` (×${multiplier} multiplier)`}
                        </Label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="flex items-center justify-between text-sm bg-muted p-3 rounded-lg">
              <div>
                <span className="font-medium">{matchedRows.length}</span> items
                <span className="mx-2">•</span>
                <span className="text-green-600">{inventoryCount} inventory restocks</span>
                <span className="mx-2">•</span>
                <span className="text-yellow-600">{generalCount} general expenses</span>
              </div>
              <div className="font-medium">
                Total: {formatCurrency(totalAmount)}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="border rounded-lg p-6 space-y-4">
              <h3 className="font-medium">Import Summary</h3>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                  <p className="text-green-700 dark:text-green-300 font-medium">{inventoryCount} Inventory Restocks</p>
                  <p className="text-green-600 dark:text-green-400 text-xs">Will update stock levels and costs</p>
                </div>
                <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                  <p className="text-yellow-700 dark:text-yellow-300 font-medium">{generalCount} General Expenses</p>
                  <p className="text-yellow-600 dark:text-yellow-400 text-xs">Will be recorded as general allocations</p>
                </div>
              </div>
              
              {Object.values(saveMapping).filter(Boolean).length > 0 && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-sm">
                  <p className="text-blue-700 dark:text-blue-300 font-medium flex items-center gap-1">
                    <Bookmark className="h-4 w-4" />
                    {Object.values(saveMapping).filter(Boolean).length} new mappings will be saved
                  </p>
                  <p className="text-blue-600 dark:text-blue-400 text-xs">These items will auto-match in future imports</p>
                </div>
              )}
              
              <div className="border-t pt-4">
                <p className="text-lg font-medium">
                  Total Amount: {formatCurrency(totalAmount)}
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step !== 'upload' && (
            <Button 
              variant="outline" 
              onClick={() => {
                if (step === 'mapping') setStep('upload');
                else if (step === 'matching') setStep('mapping');
                else if (step === 'confirm') setStep('matching');
              }}
              disabled={loading}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          
          {step === 'mapping' && (
            <Button onClick={proceedToMatching} disabled={loading}>
              {loading ? 'Processing...' : 'Match Items'}
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          
          {step === 'matching' && (
            <Button onClick={() => setStep('confirm')}>
              Review Import
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          
          {step === 'confirm' && (
            <Button onClick={handleConfirm} disabled={loading}>
              {loading ? 'Importing...' : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Import {matchedRows.length} Items
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
