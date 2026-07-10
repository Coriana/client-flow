import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, X, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { todayLocal } from '@/lib/dates';
import { uuid } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';

interface Allocation {
  id: string;
  type: 'job_expense' | 'inventory_restock' | 'general';
  job_id?: string;
  item_id?: string;
  quantity?: number;
  amount: number;
  isExisting?: boolean;
  dbId?: string;
}

interface Job {
  id: string;
  name: string;
  job_number: string;
}

interface Item {
  id: string;
  name: string;
  sku: string;
}

interface Vendor {
  id: string;
  name: string;
}

type Purchase = Tables<'purchases'>;

interface EditPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  purchase: Purchase | null;
}

export default function EditPurchaseDialog({ open, onOpenChange, onSuccess, purchase }: EditPurchaseDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [amountIncludesGst, setAmountIncludesGst] = useState(false); // Default false for editing existing
  const [defaultGstRate, setDefaultGstRate] = useState(10);
  
  const [editData, setEditData] = useState({
    date: todayLocal(),
    vendor_id: '',
    vendor_name: '',
    description: '',
    amount: 0,
    tax_amount: 0,
    payment_method: '',
    reference: '',
    notes: '',
    receipt_url: null as string | null,
  });
  
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [allocationsLoaded, setAllocationsLoaded] = useState(false);
  const loadingRef = useRef(false);
  const lastPurchaseIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (open && purchase?.id) {
      // Prevent duplicate loads for same purchase
      if (loadingRef.current || lastPurchaseIdRef.current === purchase.id) return;
      loadingRef.current = true;
      lastPurchaseIdRef.current = purchase.id;
      
      // Reset state when dialog opens
      setAllocationsLoaded(false);
      setAllocations([]);
      fetchData();
      loadPurchaseData().finally(() => {
        loadingRef.current = false;
      });
    } else if (!open) {
      // Reset all flags when dialog closes
      loadingRef.current = false;
      lastPurchaseIdRef.current = null;
      setAllocationsLoaded(false);
      setAllocations([]);
    }
  }, [open, purchase?.id]);

  async function fetchData() {
    const [jobsRes, itemsRes, vendorsRes, settingsRes] = await Promise.all([
      supabase.from('jobs').select('id, name, job_number').in('status', ['active', 'prospect']).order('name'),
      supabase.from('items').select('id, name, sku').eq('is_active', true).order('name'),
      supabase.from('vendors').select('id, name').eq('is_active', true).order('name'),
      supabase.from('company_settings').select('default_tax_rate').limit(1).single(),
    ]);
    setJobs(jobsRes.data || []);
    setItems(itemsRes.data || []);
    setVendors(vendorsRes.data || []);
    if (settingsRes.data?.default_tax_rate) {
      setDefaultGstRate(settingsRes.data.default_tax_rate);
    }
  }

  async function loadPurchaseData() {
    if (!purchase) return;
    
    setEditData({
      date: purchase.date,
      vendor_id: purchase.vendor_id || '',
      vendor_name: purchase.vendor_name || '',
      description: purchase.description,
      amount: purchase.amount,
      tax_amount: purchase.tax_amount || 0,
      payment_method: purchase.payment_method || '',
      reference: purchase.reference || '',
      notes: purchase.notes || '',
      receipt_url: purchase.receipt_url,
    });

    // Load existing allocations
    const { data: existingAllocations } = await supabase
      .from('purchase_allocations')
      .select('*')
      .eq('purchase_id', purchase.id);

    if (existingAllocations && existingAllocations.length > 0) {
      setAllocations(existingAllocations.map(a => ({
        id: uuid(),
        dbId: a.id,
        type: a.allocation_type as Allocation['type'],
        job_id: a.job_id || undefined,
        item_id: a.item_id || undefined,
        quantity: a.quantity || undefined,
        amount: a.amount,
        isExisting: true,
      })));
    } else {
      // Default to general allocation with total amount
      setAllocations([{ 
        id: uuid(),
        type: 'general', 
        amount: purchase.total 
      }]);
    }
    setAllocationsLoaded(true);
  }

  async function handleReceiptUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `receipts/${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(fileName, file, { upsert: true });
    
    if (uploadError) {
      toast({ title: 'Error', description: uploadError.message, variant: 'destructive' });
      setUploading(false);
      return;
    }
    
    const { data: urlData } = supabase.storage.from('images').getPublicUrl(fileName);
    setEditData({ ...editData, receipt_url: urlData.publicUrl });
    toast({ title: 'Success', description: 'Receipt uploaded' });
    setUploading(false);
  }

  function addAllocation() {
    setAllocations([
      ...allocations,
      { id: uuid(), type: 'general', amount: 0 }
    ]);
  }

  function removeAllocation(id: string) {
    if (allocations.length > 1) {
      setAllocations(allocations.filter(a => a.id !== id));
    }
  }

  function updateAllocation(id: string, updates: Partial<Allocation>) {
    setAllocations(allocations.map(a => 
      a.id === id ? { ...a, ...updates } : a
    ));
  }

  async function handleSubmit() {
    if (!purchase) return;
    
    if (!editData.description || editData.amount <= 0) {
      toast({ title: 'Error', description: 'Description and amount are required', variant: 'destructive' });
      return;
    }
    
    if (!allocationsLoaded || allocations.length === 0) {
      toast({ title: 'Error', description: 'Please wait for allocations to load', variant: 'destructive' });
      return;
    }
    
    const total = editData.amount + (editData.tax_amount || 0);
    const allocatedTotal = allocations.reduce((sum, a) => sum + a.amount, 0);
    
    if (Math.abs(allocatedTotal - total) > 0.01) {
      toast({ 
        title: 'Error', 
        description: `Allocated amount (${allocatedTotal.toFixed(2)}) doesn't match total (${total.toFixed(2)})`, 
        variant: 'destructive' 
      });
      return;
    }
    
    setSaving(true);
    
    // Update purchase
    const { error: purchaseError } = await supabase
      .from('purchases')
      .update({
        date: editData.date,
        vendor_id: editData.vendor_id || null,
        vendor_name: editData.vendor_name || null,
        description: editData.description,
        amount: editData.amount,
        tax_amount: editData.tax_amount,
        total,
        payment_method: editData.payment_method || null,
        reference: editData.reference || null,
        notes: editData.notes || null,
        receipt_url: editData.receipt_url,
      })
      .eq('id', purchase.id);
    
    if (purchaseError) {
      toast({ title: 'Error', description: purchaseError.message, variant: 'destructive' });
      setSaving(false);
      return;
    }
    
    // Delete old allocations
    await supabase.from('purchase_allocations').delete().eq('purchase_id', purchase.id);
    
    // Create new allocations
    const allocationInserts = allocations.map(a => ({
      purchase_id: purchase.id,
      allocation_type: a.type,
      job_id: a.type === 'job_expense' ? a.job_id : null,
      item_id: a.type === 'inventory_restock' ? a.item_id : null,
      quantity: a.type === 'inventory_restock' ? a.quantity : null,
      amount: a.amount,
    }));
    
    await supabase.from('purchase_allocations').insert(allocationInserts);
    
    // Update inventory for restocks - use weighted average cost
    for (const alloc of allocations) {
      if (alloc.type === 'inventory_restock' && alloc.item_id && alloc.quantity) {
        const purchaseUnitCost = alloc.amount / (alloc.quantity || 1);
        
        // Get current item data
        const { data: currentItem } = await supabase
          .from('items')
          .select('unit_cost')
          .eq('id', alloc.item_id)
          .single();
        
        if (currentItem) {
          // Calculate weighted average cost and update if significant
          const { updateItemCostWithWAC } = await import('@/hooks/useWeightedAverageCost');
          await updateItemCostWithWAC(
            alloc.item_id,
            currentItem.unit_cost || 0,
            alloc.quantity,
            purchaseUnitCost,
            editData.date,
            `Updated from purchase edit: ${editData.description}`,
            undefined
          );
        }
      }
    }
    
    toast({ title: 'Success', description: 'Purchase updated' });
    setSaving(false);
    onOpenChange(false);
    onSuccess();
  }

  const total = editData.amount + (editData.tax_amount || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Purchase</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input
                type="date"
                value={editData.date}
                onChange={(e) => setEditData({ ...editData, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Vendor</Label>
              <Select
                value={editData.vendor_id}
                onValueChange={(v) => setEditData({ ...editData, vendor_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {!editData.vendor_id && (
            <div className="space-y-2">
              <Label>Vendor Name (if not in list)</Label>
              <Input
                value={editData.vendor_name}
                onChange={(e) => setEditData({ ...editData, vendor_name: e.target.value })}
                placeholder="Enter vendor name"
              />
            </div>
          )}
          
          <div className="space-y-2">
            <Label>Description *</Label>
            <Input
              value={editData.description}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              placeholder="What was purchased?"
            />
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{amountIncludesGst ? 'Amount (inc GST) *' : 'Amount (ex GST) *'}</Label>
              <Input
                type="number"
                step="0.01"
                value={amountIncludesGst ? (editData.amount + (editData.tax_amount || 0)) || '' : editData.amount || ''}
                onChange={(e) => {
                  const inputValue = parseFloat(e.target.value) || 0;
                  if (amountIncludesGst) {
                    const gstMultiplier = 1 + (defaultGstRate / 100);
                    const exGstAmount = inputValue / gstMultiplier;
                    const gstAmount = inputValue - exGstAmount;
                    setEditData({ ...editData, amount: exGstAmount, tax_amount: gstAmount });
                    if (allocationsLoaded && allocations.length === 1) {
                      updateAllocation(allocations[0].id, { amount: inputValue });
                    }
                  } else {
                    setEditData({ ...editData, amount: inputValue });
                    if (allocationsLoaded && allocations.length === 1) {
                      updateAllocation(allocations[0].id, { amount: inputValue + (editData.tax_amount || 0) });
                    }
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>GST</Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="editAmountIncludesGst"
                    checked={amountIncludesGst}
                    onCheckedChange={(checked) => {
                      setAmountIncludesGst(checked === true);
                      if (checked) {
                        // Toggling ON: treat current total as the new inclusive amount, recalculate
                        const currentTotal = editData.amount + (editData.tax_amount || 0);
                        if (currentTotal > 0) {
                          const gstMultiplier = 1 + (defaultGstRate / 100);
                          const newExGst = currentTotal / gstMultiplier;
                          const newGst = currentTotal - newExGst;
                          setEditData({ ...editData, amount: newExGst, tax_amount: newGst });
                          if (allocationsLoaded && allocations.length === 1) {
                            updateAllocation(allocations[0].id, { amount: currentTotal });
                          }
                        }
                      }
                    }}
                  />
                  <Label htmlFor="editAmountIncludesGst" className="text-xs font-normal cursor-pointer">Inc. GST</Label>
                </div>
              </div>
              <Input
                type="number"
                step="0.01"
                value={editData.tax_amount?.toFixed(2) || ''}
                disabled={amountIncludesGst}
                onChange={(e) => {
                  const tax = parseFloat(e.target.value) || 0;
                  setEditData({ ...editData, tax_amount: tax });
                  if (allocationsLoaded && allocations.length === 1) {
                    updateAllocation(allocations[0].id, { amount: editData.amount + tax });
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Total</Label>
              <Input type="number" value={total.toFixed(2)} disabled />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select
                value={editData.payment_method}
                onValueChange={(v) => setEditData({ ...editData, payment_method: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input
                value={editData.reference}
                onChange={(e) => setEditData({ ...editData, reference: e.target.value })}
                placeholder="Invoice #, receipt #, etc."
              />
            </div>
          </div>
          
          {/* Receipt Upload */}
          <div className="space-y-2">
            <Label>Receipt</Label>
            <div className="flex items-center gap-4">
              {editData.receipt_url ? (
                <div className="flex items-center gap-2">
                  <a 
                    href={editData.receipt_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    View Receipt
                  </a>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setEditData({ ...editData, receipt_url: null })}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleReceiptUpload}
                    accept="image/*,.pdf"
                    className="hidden"
                  />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading ? 'Uploading...' : 'Upload Receipt'}
                  </Button>
                </>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={editData.notes}
              onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
            />
          </div>
          
          {/* Allocations */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Allocations</Label>
              <Button variant="outline" size="sm" onClick={addAllocation}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
            
            {allocations.map((alloc) => (
              <div key={alloc.id} className="flex gap-3 items-start p-3 border rounded-lg bg-muted/30">
                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Type</Label>
                      <Select
                        value={alloc.type}
                        onValueChange={(v: Allocation['type']) => updateAllocation(alloc.id, { 
                          type: v, 
                          job_id: undefined, 
                          item_id: undefined, 
                          quantity: undefined 
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">General Expense</SelectItem>
                          <SelectItem value="job_expense">Job Expense</SelectItem>
                          <SelectItem value="inventory_restock">Inventory Restock</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={alloc.amount || ''}
                        onChange={(e) => updateAllocation(alloc.id, { amount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  
                  {alloc.type === 'job_expense' && (
                    <div className="space-y-1">
                      <Label className="text-xs">Job</Label>
                      <Select
                        value={alloc.job_id}
                        onValueChange={(v) => updateAllocation(alloc.id, { job_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select job" />
                        </SelectTrigger>
                        <SelectContent>
                          {jobs.map((j) => (
                            <SelectItem key={j.id} value={j.id}>
                              {j.job_number} - {j.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {alloc.type === 'inventory_restock' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Item</Label>
                        <Select
                          value={alloc.item_id}
                          onValueChange={(v) => updateAllocation(alloc.id, { item_id: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select item" />
                          </SelectTrigger>
                          <SelectContent>
                            {items.map((i) => (
                              <SelectItem key={i.id} value={i.id}>
                                {i.sku} - {i.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Quantity</Label>
                        <Input
                          type="number"
                          value={alloc.quantity || ''}
                          onChange={(e) => updateAllocation(alloc.id, { quantity: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                {allocations.length > 1 && (
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => removeAllocation(alloc.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            
            <div className="text-sm text-muted-foreground">
              Allocated: ${allocations.reduce((sum, a) => sum + a.amount, 0).toFixed(2)} / Total: ${total.toFixed(2)}
            </div>
          </div>
          
          <Button className="w-full" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
