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
import { Upload, X, Plus, Trash2, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { todayLocal } from '@/lib/dates';
import { uuid } from '@/lib/utils';
import ImportBillCSVDialog, { ImportedAllocation } from '@/components/purchases/ImportBillCSVDialog';

interface Allocation {
  id: string;
  type: 'job_expense' | 'inventory_restock' | 'general';
  job_id?: string;
  item_id?: string;
  quantity?: number;
  amount: number;
  description?: string;
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

interface MakePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function MakePaymentDialog({ open, onOpenChange, onSuccess }: MakePaymentDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [bankAccounts, setBankAccounts] = useState<{ id: string; name: string; current_balance: number }[]>([]);
  const [amountIncludesGst, setAmountIncludesGst] = useState(true);
  const [defaultGstRate, setDefaultGstRate] = useState(10); // Default 10% GST
  
  const [purchase, setPurchase] = useState({
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
    bank_account_id: '',
  });
  
  const [allocations, setAllocations] = useState<Allocation[]>([
    { id: uuid(), type: 'general', amount: 0 }
  ]);

  function handleCSVImport(imported: ImportedAllocation[]) {
    // Convert imported allocations to our format
    const newAllocations: Allocation[] = imported.map(imp => ({
      id: uuid(),
      type: imp.type,
      item_id: imp.item_id,
      quantity: imp.quantity,
      amount: imp.amount,
      description: imp.description,
    }));
    
    // Calculate total from import (this is the total from CSV)
    const totalAmount = imported.reduce((sum, a) => sum + a.amount, 0);
    
    // Calculate GST if enabled (default is enabled)
    // The amount stays as totalAmount, we just calculate what portion is GST
    const gstAmount = amountIncludesGst 
      ? totalAmount * (defaultGstRate / (100 + defaultGstRate))
      : 0;
    
    setAllocations(newAllocations);
    setPurchase(p => ({
      ...p,
      amount: totalAmount - gstAmount,
      tax_amount: gstAmount,
      description: p.description || 'Imported from CSV',
    }));
    
    toast({ title: 'Imported', description: `${imported.length} line items added to allocations` });
  }

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  async function fetchData() {
    const [jobsRes, itemsRes, vendorsRes, bankRes, settingsRes] = await Promise.all([
      supabase.from('jobs').select('id, name, job_number').in('status', ['active', 'prospect']).order('name'),
      supabase.from('items').select('id, name, sku').eq('is_active', true).order('name'),
      supabase.from('vendors').select('id, name').eq('is_active', true).order('name'),
      supabase.from('bank_accounts').select('id, name, current_balance').eq('is_active', true).order('name'),
      supabase.from('company_settings').select('default_tax_rate').limit(1).single(),
    ]);
    setJobs(jobsRes.data || []);
    setItems(itemsRes.data || []);
    setVendors(vendorsRes.data || []);
    setBankAccounts(bankRes.data || []);
    if (settingsRes.data?.default_tax_rate) {
      setDefaultGstRate(settingsRes.data.default_tax_rate);
    }
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
    setPurchase({ ...purchase, receipt_url: urlData.publicUrl });
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
    if (!purchase.description || purchase.amount <= 0) {
      toast({ title: 'Error', description: 'Description and amount are required', variant: 'destructive' });
      return;
    }
    
    const total = purchase.amount + (purchase.tax_amount || 0);
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
    
    // Get current user
    const { data: userData } = await supabase.auth.getUser();
    
    // Create purchase
    const { data: purchaseData, error: purchaseError } = await supabase
      .from('purchases')
      .insert({
        date: purchase.date,
        vendor_id: purchase.vendor_id || null,
        vendor_name: purchase.vendor_name || null,
        description: purchase.description,
        amount: purchase.amount,
        tax_amount: purchase.tax_amount,
        total,
        payment_method: purchase.payment_method || null,
        reference: purchase.reference || null,
        notes: purchase.notes || null,
        receipt_url: purchase.receipt_url,
        created_by: userData.user?.id,
      })
      .select()
      .single();
    
    if (purchaseError) {
      toast({ title: 'Error', description: purchaseError.message, variant: 'destructive' });
      setSaving(false);
      return;
    }
    
    // Create allocations
    const allocationInserts = allocations.map(a => ({
      purchase_id: purchaseData.id,
      allocation_type: a.type,
      job_id: a.type === 'job_expense' ? a.job_id : null,
      item_id: a.type === 'inventory_restock' ? a.item_id : null,
      quantity: a.type === 'inventory_restock' ? a.quantity : null,
      amount: a.amount,
      description: a.description || null,
    }));
    
    const { error: allocError } = await supabase.from('purchase_allocations').insert(allocationInserts);
    if (allocError) {
      console.error('Failed to insert allocations:', allocError);
    }
    
    // Update inventory stock for restocks
    for (const alloc of allocations) {
      if (alloc.type === 'inventory_restock' && alloc.item_id && alloc.quantity) {
        // Get current item data
        const { data: currentItem } = await supabase
          .from('items')
          .select('current_stock, unit_cost')
          .eq('id', alloc.item_id)
          .single();
        
        const purchaseUnitCost = alloc.amount / (alloc.quantity || 1);
        
        // Log inventory movement first (with movement_date)
        await supabase.from('inventory_movements').insert({
          item_id: alloc.item_id,
          movement_type: 'purchase',
          quantity: alloc.quantity,
          unit_cost: purchaseUnitCost,
          movement_date: purchase.date,
          reference: `Purchase ${purchaseData.id}`,
          notes: purchase.description,
          created_by: userData.user?.id,
        });
        
        if (currentItem) {
          // Update stock quantity
          await supabase
            .from('items')
            .update({ 
              current_stock: (currentItem.current_stock || 0) + (alloc.quantity || 0)
            })
            .eq('id', alloc.item_id);
          
          // Calculate weighted average cost and update if significant
          const { updateItemCostWithWAC } = await import('@/hooks/useWeightedAverageCost');
          await updateItemCostWithWAC(
            alloc.item_id,
            currentItem.unit_cost || 0,
            alloc.quantity,
            purchaseUnitCost,
            purchase.date,
            `Updated from purchase: ${purchase.description}`,
            userData.user?.id
          );
        }
      }
      
      // Create expense for job allocations
      if (alloc.type === 'job_expense' && alloc.job_id) {
        await supabase.from('expenses').insert({
          job_id: alloc.job_id,
          date: purchase.date,
          amount: alloc.amount,
          description: purchase.description,
          category: 'Purchase',
          vendor_id: purchase.vendor_id || null,
          receipt_url: purchase.receipt_url,
          is_billable: false,
          user_id: userData.user?.id,
        });
      }
    }
    
    // Update bank account balance if selected
    if (purchase.bank_account_id) {
      const bankAccount = bankAccounts.find(b => b.id === purchase.bank_account_id);
      if (bankAccount) {
        await supabase
          .from('bank_accounts')
          .update({ current_balance: bankAccount.current_balance - total })
          .eq('id', purchase.bank_account_id);
      }
    }
    
    toast({ title: 'Success', description: 'Payment recorded' });
    
    // Reset form
    setPurchase({
      date: todayLocal(),
      vendor_id: '',
      vendor_name: '',
      description: '',
      amount: 0,
      tax_amount: 0,
      payment_method: '',
      reference: '',
      notes: '',
      receipt_url: null,
      bank_account_id: '',
    });
    setAllocations([{ id: uuid(), type: 'general', amount: 0 }]);
    
    setSaving(false);
    onOpenChange(false);
    onSuccess();
  }

  const total = purchase.amount + (purchase.tax_amount || 0);

  return (
    <>
      <ImportBillCSVDialog 
        open={showImportDialog} 
        onOpenChange={setShowImportDialog}
        onImport={handleCSVImport}
      />
      
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Pay Vendor / Record Expense</DialogTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowImportDialog(true)}
                className="mr-6"
              >
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                Import CSV
              </Button>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={purchase.date}
                  onChange={(e) => setPurchase({ ...purchase, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Vendor</Label>
                <Select
                  value={purchase.vendor_id}
                  onValueChange={(v) => setPurchase({ ...purchase, vendor_id: v })}
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
          
          {!purchase.vendor_id && (
            <div className="space-y-2">
              <Label>Vendor Name (if not in list)</Label>
              <Input
                value={purchase.vendor_name}
                onChange={(e) => setPurchase({ ...purchase, vendor_name: e.target.value })}
                placeholder="Enter vendor name"
              />
            </div>
          )}
          
          <div className="space-y-2">
            <Label>Description *</Label>
            <Input
              value={purchase.description}
              onChange={(e) => setPurchase({ ...purchase, description: e.target.value })}
              placeholder="What was purchased?"
            />
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{amountIncludesGst ? 'Amount (inc GST) *' : 'Amount (ex GST) *'}</Label>
              <Input
                type="number"
                step="0.01"
                value={amountIncludesGst ? (purchase.amount + (purchase.tax_amount || 0)) || '' : purchase.amount || ''}
                onChange={(e) => {
                  const inputValue = parseFloat(e.target.value) || 0;
                  if (amountIncludesGst) {
                    // Calculate ex-GST amount and GST from inclusive amount
                    const gstMultiplier = 1 + (defaultGstRate / 100);
                    const exGstAmount = inputValue / gstMultiplier;
                    const gstAmount = inputValue - exGstAmount;
                    setPurchase({ ...purchase, amount: exGstAmount, tax_amount: gstAmount });
                    if (allocations.length === 1) {
                      updateAllocation(allocations[0].id, { amount: inputValue });
                    }
                  } else {
                    setPurchase({ ...purchase, amount: inputValue });
                    if (allocations.length === 1) {
                      updateAllocation(allocations[0].id, { amount: inputValue + (purchase.tax_amount || 0) });
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
                    id="amountIncludesGst"
                    checked={amountIncludesGst}
                    onCheckedChange={(checked) => setAmountIncludesGst(checked === true)}
                  />
                  <Label htmlFor="amountIncludesGst" className="text-xs font-normal cursor-pointer">Inc. GST</Label>
                </div>
              </div>
              <Input
                type="number"
                step="0.01"
                value={purchase.tax_amount?.toFixed(2) || ''}
                disabled={amountIncludesGst}
                onChange={(e) => {
                  const tax = parseFloat(e.target.value) || 0;
                  setPurchase({ ...purchase, tax_amount: tax });
                  if (allocations.length === 1) {
                    updateAllocation(allocations[0].id, { amount: purchase.amount + tax });
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
                value={purchase.payment_method}
                onValueChange={(v) => setPurchase({ ...purchase, payment_method: v })}
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
                value={purchase.reference}
                onChange={(e) => setPurchase({ ...purchase, reference: e.target.value })}
                placeholder="Invoice #, receipt #, etc."
              />
            </div>
          </div>
          
          {/* Bank Account Selection */}
          {bankAccounts.length > 0 && (
            <div className="space-y-2">
              <Label>Paid From Bank Account</Label>
              <Select
                value={purchase.bank_account_id}
                onValueChange={(v) => setPurchase({ ...purchase, bank_account_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select bank account (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} (${Number(acc.current_balance).toLocaleString('en-AU', { minimumFractionDigits: 2 })})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select to automatically update the bank balance
              </p>
            </div>
          )}
          
          {/* Receipt Upload */}
          <div className="space-y-2">
            <Label>Receipt</Label>
            <div className="flex items-center gap-4">
              {purchase.receipt_url ? (
                <div className="flex items-center gap-2">
                  <a 
                    href={purchase.receipt_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    View Receipt
                  </a>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setPurchase({ ...purchase, receipt_url: null })}
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
          
          {/* Allocations */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Allocations</Label>
              <Button variant="outline" size="sm" onClick={addAllocation}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
            
            {allocations.map((alloc, index) => (
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
          
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={purchase.notes}
              onChange={(e) => setPurchase({ ...purchase, notes: e.target.value })}
            />
          </div>
          
          <Button className="w-full" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : 'Record Payment'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
