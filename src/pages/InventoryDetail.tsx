import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useBranding } from '@/contexts/BrandingContext';
import { ArrowLeft, Save, Upload, History, ChevronDown, ChevronUp, Package, ArrowDownCircle, ArrowUpCircle, RefreshCw } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

interface PriceHistory {
  id: string;
  old_unit_cost: number | null;
  new_unit_cost: number | null;
  old_sales_price: number | null;
  new_sales_price: number | null;
  changed_at: string;
  reason: string | null;
}

type InventoryMovement = Tables<'inventory_movements'> & {
  jobs?: { id: string; name: string; job_number: string } | null;
};

// Combined history item type
interface HistoryItem {
  id: string;
  date: string;
  type: 'price_change' | 'movement';
  description: string;
  movementType?: string;
  quantity?: number;
  unitCost?: number;
  jobId?: string;
  jobName?: string;
  oldCost?: number | null;
  newCost?: number | null;
  oldPrice?: number | null;
  newPrice?: number | null;
  reason?: string | null;
}

export default function InventoryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { formatCurrency } = useBranding();
  const isNew = id === 'new';
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [originalPrices, setOriginalPrices] = useState({ unit_cost: 0, sales_price: 0 });
  const [priceChangeReason, setPriceChangeReason] = useState('');
  
  const [item, setItem] = useState({
    sku: '',
    name: '',
    description: '',
    category: '',
    unit: 'each',
    unit_cost: 0,
    sales_price: 0,
    current_stock: 0,
    reorder_level: 0,
    is_active: true,
    image_url: null as string | null,
  });

  useEffect(() => {
    if (!isNew && id) {
      fetchItem();
      fetchPriceHistory();
      fetchMovements();
    }
  }, [id, isNew]);

  async function fetchItem() {
    const { data, error } = await supabase.from('items').select('*').eq('id', id).single();
    if (error) { navigate('/inventory'); return; }
    setItem(data);
    setOriginalPrices({ unit_cost: data.unit_cost || 0, sales_price: data.sales_price || 0 });
    setLoading(false);
  }

  async function fetchPriceHistory() {
    const { data } = await supabase
      .from('item_price_history')
      .select('*')
      .eq('item_id', id)
      .order('changed_at', { ascending: false });
    setPriceHistory(data || []);
  }

  async function fetchMovements() {
    const { data } = await supabase
      .from('inventory_movements')
      .select('*, jobs(id, name, job_number)')
      .eq('item_id', id)
      .order('created_at', { ascending: false });
    setMovements(data || []);
  }

  async function handleSave() {
    setSaving(true);
    if (!item.sku || !item.name) {
      toast({ title: 'Error', description: 'SKU and Name are required', variant: 'destructive' });
      setSaving(false);
      return;
    }
    
    // Check if price change is significant (not just floating point noise)
    const { isPriceChangeSignificant } = await import('@/hooks/useWeightedAverageCost');
    const unitCostChanged = isPriceChangeSignificant(originalPrices.unit_cost, item.unit_cost || 0);
    const salesPriceChanged = isPriceChangeSignificant(originalPrices.sales_price, item.sales_price || 0);
    const priceChanged = !isNew && (unitCostChanged || salesPriceChanged);
    
    if (isNew) {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.from('items').insert({ ...item, user_id: userData.user?.id }).select().single();
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else { toast({ title: 'Success', description: 'Item created' }); navigate(`/inventory/${data.id}`); }
    } else {
      const { error } = await supabase.from('items').update(item).eq('id', id);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        // Log price change if prices changed
        if (priceChanged) {
          await supabase.from('item_price_history').insert({
            item_id: id,
            old_unit_cost: originalPrices.unit_cost,
            new_unit_cost: item.unit_cost,
            old_sales_price: originalPrices.sales_price,
            new_sales_price: item.sales_price,
            reason: priceChangeReason || null,
          });
          setOriginalPrices({ unit_cost: item.unit_cost || 0, sales_price: item.sales_price || 0 });
          setPriceChangeReason('');
          fetchPriceHistory();
        }
        toast({ title: 'Success', description: 'Item updated' });
      }
    }
    setSaving(false);
  }

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `items/${id || 'new'}-${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(fileName, file, { upsert: true });
    
    if (uploadError) {
      toast({ title: 'Error', description: uploadError.message, variant: 'destructive' });
      setUploading(false);
      return;
    }
    
    const { data: urlData } = supabase.storage.from('images').getPublicUrl(fileName);
    setItem({ ...item, image_url: urlData.publicUrl });
    
    if (!isNew) {
      await supabase.from('items').update({ image_url: urlData.publicUrl }).eq('id', id);
    }
    
    toast({ title: 'Success', description: 'Image uploaded' });
    setUploading(false);
  }

  const pricesChanged = !isNew && (
    (item.unit_cost || 0) !== originalPrices.unit_cost ||
    (item.sales_price || 0) !== originalPrices.sales_price
  );

  // Combine price history with movements for comprehensive timeline
  const getCombinedHistory = (): HistoryItem[] => {
    const priceItems: HistoryItem[] = priceHistory.map(p => ({
      id: p.id,
      date: p.changed_at,
      type: 'price_change' as const,
      description: 'Price updated',
      oldCost: p.old_unit_cost,
      newCost: p.new_unit_cost,
      oldPrice: p.old_sales_price,
      newPrice: p.new_sales_price,
      reason: p.reason,
    }));

    const movementItems: HistoryItem[] = movements.map(m => ({
      id: m.id,
      date: m.created_at,
      type: 'movement' as const,
      description: m.notes || m.reference || `${m.movement_type} movement`,
      movementType: m.movement_type,
      quantity: m.quantity,
      unitCost: m.unit_cost || undefined,
      jobId: m.jobs?.id,
      jobName: m.jobs ? `${m.jobs.job_number} - ${m.jobs.name}` : undefined,
    }));

    return [...priceItems, ...movementItems].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  };

  const combinedHistory = getCombinedHistory();
  const displayedHistory = showAllHistory ? combinedHistory : combinedHistory.slice(0, 5);

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'purchase': return <ArrowDownCircle className="h-4 w-4 text-green-500" />;
      case 'consume': return <ArrowUpCircle className="h-4 w-4 text-red-500" />;
      case 'adjust': return <RefreshCw className="h-4 w-4 text-blue-500" />;
      case 'return': return <ArrowDownCircle className="h-4 w-4 text-amber-500" />;
      default: return <Package className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getMovementBadge = (type: string) => {
    switch (type) {
      case 'purchase': return <Badge className="bg-green-500">Purchase</Badge>;
      case 'consume': return <Badge className="bg-red-500">Used</Badge>;
      case 'adjust': return <Badge className="bg-blue-500">Adjustment</Badge>;
      case 'return': return <Badge className="bg-amber-500">Return</Badge>;
      default: return <Badge variant="secondary">{type}</Badge>;
    }
  };

  if (loading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/inventory"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{isNew ? 'New Item' : item.name}</h1>
          <p className="text-muted-foreground">{isNew ? 'Add a new inventory item' : `SKU: ${item.sku}`}</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />{saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Item Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Image</Label>
              <div className="flex items-center gap-4">
                {item.image_url ? (
                  <img 
                    src={item.image_url} 
                    alt={item.name} 
                    className="h-24 w-24 object-cover rounded-lg border"
                  />
                ) : (
                  <div className="h-24 w-24 bg-muted rounded-lg border flex items-center justify-center">
                    <span className="text-muted-foreground text-xs">No image</span>
                  </div>
                )}
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading ? 'Uploading...' : 'Upload'}
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SKU *</Label>
                <Input value={item.sku} onChange={(e) => setItem({ ...item, sku: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input value={item.category || ''} onChange={(e) => setItem({ ...item, category: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={item.description || ''} onChange={(e) => setItem({ ...item, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={item.unit || 'each'} onValueChange={(v) => setItem({ ...item, unit: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="each">Each</SelectItem>
                  <SelectItem value="hour">Hour</SelectItem>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="meter">Meter</SelectItem>
                  <SelectItem value="kg">Kg</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={item.is_active} onCheckedChange={(v) => setItem({ ...item, is_active: v })} />
              <Label>Active</Label>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader><CardTitle>Pricing & Stock</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Unit Cost</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={item.unit_cost || ''} 
                  onChange={(e) => setItem({ ...item, unit_cost: parseFloat(e.target.value) || 0 })} 
                />
              </div>
              <div className="space-y-2">
                <Label>Sales Price</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={item.sales_price || ''} 
                  onChange={(e) => setItem({ ...item, sales_price: parseFloat(e.target.value) || 0 })} 
                />
              </div>
            </div>
            
            {pricesChanged && (
              <div className="space-y-2 p-3 border rounded-lg bg-amber-50 dark:bg-amber-950">
                <Label className="text-amber-700 dark:text-amber-300">Price Change Reason (optional)</Label>
                <Input 
                  value={priceChangeReason} 
                  onChange={(e) => setPriceChangeReason(e.target.value)} 
                  placeholder="e.g., Supplier price increase"
                />
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Current Stock</Label>
                <Input 
                  type="number" 
                  value={item.current_stock || ''} 
                  onChange={(e) => setItem({ ...item, current_stock: parseInt(e.target.value) || 0 })} 
                />
              </div>
              <div className="space-y-2">
                <Label>Reorder Level</Label>
                <Input 
                  type="number" 
                  value={item.reorder_level || ''} 
                  onChange={(e) => setItem({ ...item, reorder_level: parseInt(e.target.value) || 0 })} 
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {!isNew && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Item History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {combinedHistory.length === 0 ? (
                <p className="text-muted-foreground">No history recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {displayedHistory.map((record) => (
                    <div key={record.id} className="flex justify-between items-start p-3 rounded-lg border bg-muted/30">
                      {record.type === 'price_change' ? (
                        <>
                          <div className="flex gap-3">
                            <RefreshCw className="h-4 w-4 text-blue-500 mt-1" />
                            <div>
                              <div className="text-sm font-medium flex items-center gap-2">
                                Price Change
                                <Badge variant="outline">Pricing</Badge>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {new Date(record.date).toLocaleDateString('en-AU', {
                                  year: 'numeric', month: 'short', day: 'numeric',
                                  hour: '2-digit', minute: '2-digit',
                                })}
                              </div>
                              {record.reason && (
                                <div className="text-sm text-muted-foreground mt-1">"{record.reason}"</div>
                              )}
                            </div>
                          </div>
                          <div className="text-right text-sm">
                            {(record.oldCost !== record.newCost) && (
                              <div>Cost: {formatCurrency(record.oldCost ?? 0)} → {formatCurrency(record.newCost ?? 0)}</div>
                            )}
                            {(record.oldPrice !== record.newPrice) && (
                              <div>Price: {formatCurrency(record.oldPrice ?? 0)} → {formatCurrency(record.newPrice ?? 0)}</div>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex gap-3">
                            {getMovementIcon(record.movementType || '')}
                            <div>
                              <div className="text-sm font-medium flex items-center gap-2">
                                {record.movementType === 'consume' && record.jobName ? (
                                  <Link to={`/jobs/${record.jobId}`} className="hover:underline">
                                    Used on {record.jobName}
                                  </Link>
                                ) : (
                                  record.description
                                )}
                                {getMovementBadge(record.movementType || '')}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {new Date(record.date).toLocaleDateString('en-AU', {
                                  year: 'numeric', month: 'short', day: 'numeric',
                                  hour: '2-digit', minute: '2-digit',
                                })}
                              </div>
                            </div>
                          </div>
                          <div className="text-right text-sm">
                            <div className={record.movementType === 'consume' ? 'text-red-600' : 'text-green-600'}>
                              {record.movementType === 'consume' ? '-' : '+'}{record.quantity} {item.unit}
                            </div>
                            {record.unitCost && (
                              <div className="text-muted-foreground text-xs">
                                @ {formatCurrency(record.unitCost ?? 0)}/{item.unit}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  
                  {combinedHistory.length > 5 && (
                    <Button 
                      variant="ghost" 
                      className="w-full"
                      onClick={() => setShowAllHistory(!showAllHistory)}
                    >
                      {showAllHistory ? (
                        <>
                          <ChevronUp className="h-4 w-4 mr-2" />
                          Show Less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-2" />
                          Show All ({combinedHistory.length} records)
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
