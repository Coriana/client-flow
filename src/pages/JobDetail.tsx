import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Save, Trash2, Plus, X, FileText, Pencil, AlertTriangle, Ban, Package, History } from 'lucide-react';
import { useAssetConflicts } from '@/hooks/useAssetConflicts';
import JobHistory from '@/components/JobHistory';
import LocationSelector from '@/components/LocationSelector';
import type { Tables } from '@/integrations/supabase/types';

type Job = Tables<'jobs'>;
type Client = Tables<'clients'>;
type Asset = Tables<'assets'>;
type JobAsset = Tables<'job_assets'>;
type Item = Tables<'items'>;
type InventoryMovement = Tables<'inventory_movements'>;

interface TradingName {
  id: string;
  name: string;
  is_default: boolean;
}

interface JobAssetWithDetails extends JobAsset {
  assets?: Asset;
}

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isNew = id === 'new';
  
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [jobAssets, setJobAssets] = useState<JobAssetWithDetails[]>([]);
  const [tradingNames, setTradingNames] = useState<TradingName[]>([]);
  const [job, setJob] = useState<Partial<Job & { trading_name_id?: string | null }>>({
    job_number: '',
    name: '',
    description: '',
    status: 'prospect',
    client_id: null,
    start_date: null,
    end_date: null,
    budget: null,
    hourly_rate: null,
    is_recurring: false,
    billing_day: 1,
    recurring_rate: 0,
    next_invoice_date: null,
    invoice_lead_days: 7,
    trading_name_id: null,
  });
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [inventoryMovements, setInventoryMovements] = useState<(InventoryMovement & { items?: Item })[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [lockedTimesheetIds, setLockedTimesheetIds] = useState<Set<string>>(new Set());
  const [lockedExpenseIds, setLockedExpenseIds] = useState<Set<string>>(new Set());
  const [editingTime, setEditingTime] = useState<any>(null);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [assetConflictWarning, setAssetConflictWarning] = useState<{ type: 'blocked' | 'warning'; message: string } | null>(null);

  // Asset conflict detection
  const { conflicts, checkAssetAvailability } = useAssetConflicts(id);

  // New entry forms
  const [showTimeForm, setShowTimeForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [showInventoryForm, setShowInventoryForm] = useState(false);
  const [editingJobAsset, setEditingJobAsset] = useState<JobAssetWithDetails | null>(null);
  
  const [newInventoryUsage, setNewInventoryUsage] = useState({
    item_id: '',
    quantity: '',
    notes: '',
  });
  
  const [newTime, setNewTime] = useState({
    date: new Date().toISOString().split('T')[0],
    hours: '',
    description: '',
    is_billable: true, // Will be updated from settings
  });
  
  const [newExpense, setNewExpense] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    description: '',
    category: '',
    is_billable: false, // Will be updated from settings
  });

  const [billableDefaults, setBillableDefaults] = useState({ time: true, expenses: false });

  const [newJobAsset, setNewJobAsset] = useState({
    asset_id: '',
    rental_start_date: new Date().toISOString().split('T')[0],
    rental_end_date: '',
    billing_frequency: 'monthly',
    billing_day: 1,
    rental_rate: '',
    invoice_lead_days: 7,
    billing_in_advance: true,
  });

  useEffect(() => {
    fetchClients();
    fetchAllAssets();
    fetchTradingNames();
    fetchAllItems();
    if (!isNew && id) {
      fetchJob();
      fetchRelatedData();
    } else {
      fetchDefaultsForNewJob();
    }
  }, [id, isNew]);

  async function fetchAllItems() {
    const { data } = await supabase.from('items').select('*').eq('is_active', true).order('name');
    setAllItems(data || []);
  }

  async function fetchDefaultsForNewJob() {
    // Get default hourly rate, trading name, and billable defaults
    const [settingsRes, tradingRes] = await Promise.all([
      supabase.from('company_settings').select('default_hourly_rate, default_billable_time, default_billable_expenses, default_billing_in_advance').limit(1).maybeSingle(),
      supabase.from('trading_names').select('id').eq('is_default', true).maybeSingle(),
    ]);

    const year = new Date().getFullYear();
    const { count } = await supabase.from('jobs').select('*', { count: 'exact', head: true });

    // Set billable defaults
    const defaultBillableTime = settingsRes.data?.default_billable_time ?? true;
    const defaultBillableExpenses = settingsRes.data?.default_billable_expenses ?? false;
    const defaultBillingInAdvance = settingsRes.data?.default_billing_in_advance ?? false;
    setBillableDefaults({ time: defaultBillableTime, expenses: defaultBillableExpenses });
    setNewTime(prev => ({ ...prev, is_billable: defaultBillableTime }));
    setNewExpense(prev => ({ ...prev, is_billable: defaultBillableExpenses }));
    setNewJobAsset(prev => ({ ...prev, billing_in_advance: defaultBillingInAdvance }));

    setJob(prev => ({
      ...prev,
      job_number: `JOB-${year}-${String((count || 0) + 1).padStart(4, '0')}`,
      hourly_rate: settingsRes.data?.default_hourly_rate || null,
      trading_name_id: tradingRes.data?.id || null,
    }));
  }

  async function fetchTradingNames() {
    const { data } = await supabase.from('trading_names').select('*').eq('is_active', true).order('is_default', { ascending: false }).order('name');
    setTradingNames(data || []);
  }


  async function fetchClients() {
    const { data } = await supabase.from('clients').select('*').eq('is_active', true).order('name');
    setClients(data || []);
  }

  async function fetchAllAssets() {
    const { data } = await supabase.from('assets').select('*').order('name');
    setAllAssets(data || []);
  }

  async function fetchJob() {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      toast({ title: 'Error', description: 'Job not found', variant: 'destructive' });
      navigate('/jobs');
    } else {
      setJob(data);
    }
    setLoading(false);
  }

  async function fetchRelatedData() {
    const [tsRes, expRes, invRes, jobAssetsRes, profilesRes, invoiceLinesRes, invMovRes] = await Promise.all([
      supabase.from('timesheets').select('*').eq('job_id', id).order('date', { ascending: false }),
      supabase.from('expenses').select('*').eq('job_id', id).order('date', { ascending: false }),
      supabase.from('invoices').select('*').eq('job_id', id).order('issue_date', { ascending: false }),
      supabase.from('job_assets').select('*, assets(*)').eq('job_id', id).order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name'),
      supabase.from('invoice_lines').select('timesheet_id, expense_id, invoice_id'),
      supabase.from('inventory_movements').select('*, items(*)').eq('job_id', id).eq('movement_type', 'consume').order('created_at', { ascending: false }),
    ]);
    
    const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p.full_name]));
    const timesheetsWithNames = (tsRes.data || []).map(ts => ({
      ...ts,
      user_name: profileMap.get(ts.user_id) || 'Unknown'
    }));
    
    // Determine which timesheets/expenses are locked (on sent/paid invoices, not draft or void)
    const lockedStatuses = ['sent', 'partially_paid', 'paid', 'overdue'];
    const lockedInvoiceIds = new Set(
      (invRes.data || []).filter(inv => lockedStatuses.includes(inv.status)).map(inv => inv.id)
    );
    
    const lockedTs = new Set<string>();
    const lockedExp = new Set<string>();
    
    (invoiceLinesRes.data || []).forEach(line => {
      if (lockedInvoiceIds.has(line.invoice_id)) {
        if (line.timesheet_id) lockedTs.add(line.timesheet_id);
        if (line.expense_id) lockedExp.add(line.expense_id);
      }
    });
    
    setLockedTimesheetIds(lockedTs);
    setLockedExpenseIds(lockedExp);
    setTimesheets(timesheetsWithNames);
    setExpenses(expRes.data || []);
    setInvoices(invRes.data || []);
    setJobAssets(jobAssetsRes.data || []);
    setInventoryMovements(invMovRes.data || []);
  }

  async function handleSave() {
    setSaving(true);
    
    if (!job.name || !job.job_number) {
      toast({ title: 'Error', description: 'Name and Job Number are required', variant: 'destructive' });
      setSaving(false);
      return;
    }

    if (isNew) {
      const { data, error } = await supabase
        .from('jobs')
        .insert({ ...job, created_by: user?.id } as any)
        .select()
        .single();
      
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Job created' });
        navigate(`/jobs/${data.id}`);
      }
    } else {
      const { error } = await supabase
        .from('jobs')
        .update(job)
        .eq('id', id);
      
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        // If job has an end date, propagate to active job_assets
        if (job.end_date) {
          await supabase
            .from('job_assets')
            .update({ rental_end_date: job.end_date, is_active: false })
            .eq('job_id', id)
            .eq('is_active', true);
        }
        toast({ title: 'Success', description: 'Job updated' });
      }
    }
    setSaving(false);
  }

  async function handleDelete() {
    // Check for related invoices first
    const { count: invoiceCount } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('job_id', id);
    
    if (invoiceCount && invoiceCount > 0) {
      const confirmMsg = `This job has ${invoiceCount} invoice(s) attached. Deleting will unlink these invoices from the job. Continue?`;
      if (!confirm(confirmMsg)) return;
      
      // Unlink invoices from this job (set job_id to null)
      await supabase.from('invoices').update({ job_id: null }).eq('job_id', id);
    } else {
      if (!confirm('Are you sure you want to delete this job?')) return;
    }
    
    // Also delete related timesheets, expenses, and job_assets
    await Promise.all([
      supabase.from('timesheets').delete().eq('job_id', id),
      supabase.from('expenses').delete().eq('job_id', id),
      supabase.from('job_assets').delete().eq('job_id', id),
    ]);
    
    const { error } = await supabase.from('jobs').delete().eq('id', id);
    
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Job deleted' });
      navigate('/jobs');
    }
  }

  async function handleAddTime() {
    if (!newTime.hours || !user) {
      toast({ title: 'Error', description: 'Hours required', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('timesheets').insert({
      job_id: id,
      user_id: user.id,
      date: newTime.date,
      hours: parseFloat(newTime.hours),
      description: newTime.description,
      is_billable: newTime.is_billable,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Time entry added' });
      setNewTime({ date: new Date().toISOString().split('T')[0], hours: '', description: '', is_billable: billableDefaults.time });
      setShowTimeForm(false);
      fetchRelatedData();
    }
  }

  async function handleAddExpense() {
    if (!newExpense.amount || !newExpense.description) {
      toast({ title: 'Error', description: 'Amount and description required', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('expenses').insert({
      job_id: id,
      date: newExpense.date,
      amount: parseFloat(newExpense.amount),
      description: newExpense.description,
      category: newExpense.category || null,
      is_billable: newExpense.is_billable,
      user_id: user?.id,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Expense added' });
      setNewExpense({ date: new Date().toISOString().split('T')[0], amount: '', description: '', category: '', is_billable: billableDefaults.expenses });
      setShowExpenseForm(false);
      fetchRelatedData();
    }
  }

  async function handleAddJobAsset() {
    if (!newJobAsset.asset_id || !newJobAsset.rental_rate || !newJobAsset.rental_start_date) {
      toast({ title: 'Error', description: 'Asset, rental rate, and start date are required', variant: 'destructive' });
      return;
    }

    // Check if asset is assigned to a client (blocked from rental)
    const selectedAsset = allAssets.find(a => a.id === newJobAsset.asset_id);
    if (selectedAsset?.assigned_client_id) {
      toast({ 
        title: 'Asset Unavailable', 
        description: 'This asset is assigned to a client and cannot be rented out. Remove the client assignment first.', 
        variant: 'destructive' 
      });
      return;
    }

    // Check for conflicts
    const conflict = checkAssetAvailability(
      newJobAsset.asset_id, 
      newJobAsset.rental_start_date, 
      newJobAsset.rental_end_date || undefined
    );

    if (conflict) {
      if (conflict.conflictType === 'blocked') {
        toast({ title: 'Asset Unavailable', description: conflict.message, variant: 'destructive' });
        return;
      } else if (conflict.conflictType === 'warning') {
        // Show warning but allow to proceed after confirmation
        if (!confirm(`Warning: ${conflict.message}\n\nDo you want to proceed anyway?`)) {
          return;
        }
      }
    }

    // Calculate next invoice date based on start date and billing day
    const startDate = new Date(newJobAsset.rental_start_date);
    let nextInvoiceDate = new Date(startDate);
    nextInvoiceDate.setDate(newJobAsset.billing_day);
    if (nextInvoiceDate <= startDate) {
      nextInvoiceDate.setMonth(nextInvoiceDate.getMonth() + 1);
    }

    const { error } = await supabase.from('job_assets').insert({
      job_id: id,
      asset_id: newJobAsset.asset_id,
      rental_start_date: newJobAsset.rental_start_date,
      rental_end_date: newJobAsset.rental_end_date || null,
      billing_frequency: newJobAsset.billing_frequency,
      billing_day: newJobAsset.billing_day,
      rental_rate: parseFloat(newJobAsset.rental_rate),
      invoice_lead_days: newJobAsset.invoice_lead_days,
      billing_in_advance: newJobAsset.billing_in_advance,
      next_invoice_date: nextInvoiceDate.toISOString().split('T')[0],
      is_active: true,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      // Auto-assign the asset to this job's client
      if (job.client_id) {
        await supabase.from('assets').update({ assigned_client_id: job.client_id }).eq('id', newJobAsset.asset_id);
      }
      
      toast({ title: 'Success', description: 'Asset rental added' });
      setNewJobAsset({
        asset_id: '',
        rental_start_date: new Date().toISOString().split('T')[0],
        rental_end_date: '',
        billing_frequency: 'monthly',
        billing_day: 1,
        rental_rate: '',
        invoice_lead_days: 7,
        billing_in_advance: true,
      });
      setShowAssetForm(false);
      setAssetConflictWarning(null);
      fetchRelatedData();
      fetchAllAssets(); // Refresh assets to reflect new assignment
    }
  }

  // Check conflict when asset or dates change in the form
  function handleAssetFormChange(updates: Partial<typeof newJobAsset>) {
    let updatedAsset = { ...newJobAsset, ...updates };
    
    // If asset_id changed, pre-populate defaults from the asset
    if (updates.asset_id) {
      const selectedAsset = allAssets.find(a => a.id === updates.asset_id);
      if (selectedAsset) {
        if (selectedAsset.default_rental_rate) {
          updatedAsset.rental_rate = String(selectedAsset.default_rental_rate);
        }
        if (selectedAsset.default_billing_frequency) {
          updatedAsset.billing_frequency = selectedAsset.default_billing_frequency;
        }
      }
    }
    
    setNewJobAsset(updatedAsset);
    
    if (updatedAsset.asset_id && updatedAsset.rental_start_date) {
      const conflict = checkAssetAvailability(
        updatedAsset.asset_id,
        updatedAsset.rental_start_date,
        updatedAsset.rental_end_date || undefined
      );
      setAssetConflictWarning(conflict ? { type: conflict.conflictType, message: conflict.message } : null);
    } else {
      setAssetConflictWarning(null);
    }
  }

  async function handleUpdateJobAsset() {
    if (!editingJobAsset) return;

    // Get the original job_asset to check if is_active is changing
    const originalJobAsset = jobAssets.find(ja => ja.id === editingJobAsset.id);
    const isDeactivating = originalJobAsset?.is_active && !editingJobAsset.is_active;

    // Use the manually set next_invoice_date directly (user can now edit it)
    const { error } = await supabase.from('job_assets').update({
      rental_start_date: editingJobAsset.rental_start_date,
      rental_end_date: editingJobAsset.rental_end_date || null,
      billing_frequency: editingJobAsset.billing_frequency,
      billing_day: editingJobAsset.billing_day,
      rental_rate: editingJobAsset.rental_rate,
      invoice_lead_days: editingJobAsset.invoice_lead_days,
      billing_in_advance: editingJobAsset.billing_in_advance,
      is_active: editingJobAsset.is_active,
      next_invoice_date: editingJobAsset.next_invoice_date,
    }).eq('id', editingJobAsset.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      // If deactivating, check if there are other active rentals for this asset
      if (isDeactivating && editingJobAsset.asset_id) {
        const { data: remainingRentals } = await supabase
          .from('job_assets')
          .select('id')
          .eq('asset_id', editingJobAsset.asset_id)
          .eq('is_active', true)
          .neq('id', editingJobAsset.id); // Exclude the one we just deactivated
        
        // If no other active rentals remain, clear the assigned_client_id
        if (!remainingRentals || remainingRentals.length === 0) {
          await supabase.from('assets').update({ assigned_client_id: null }).eq('id', editingJobAsset.asset_id);
        }
      }
      
      toast({ title: 'Success', description: 'Asset rental updated' });
      setEditingJobAsset(null);
      fetchRelatedData();
      fetchAllAssets(); // Refresh assets to reflect updated assignment
    }
  }

  async function handleDeleteJobAsset(jaId: string) {
    if (!confirm('Remove this asset from the job?')) return;
    
    // Get the asset_id before deleting
    const jobAssetToDelete = jobAssets.find(ja => ja.id === jaId);
    const assetId = jobAssetToDelete?.asset_id;
    
    const { error } = await supabase.from('job_assets').delete().eq('id', jaId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      // Check if there are any remaining active rentals for this asset
      if (assetId) {
        const { data: remainingRentals } = await supabase
          .from('job_assets')
          .select('id')
          .eq('asset_id', assetId)
          .eq('is_active', true);
        
        // If no active rentals remain, clear the assigned_client_id
        if (!remainingRentals || remainingRentals.length === 0) {
          await supabase.from('assets').update({ assigned_client_id: null }).eq('id', assetId);
        }
      }
      
      toast({ title: 'Success', description: 'Asset rental removed' });
      fetchRelatedData();
      fetchAllAssets(); // Refresh assets to reflect updated assignment
    }
  }

  async function handleUpdateTime() {
    if (!editingTime) return;
    
    const { error } = await supabase.from('timesheets').update({
      date: editingTime.date,
      hours: parseFloat(editingTime.hours),
      description: editingTime.description,
      is_billable: editingTime.is_billable,
    }).eq('id', editingTime.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Time entry updated' });
      setEditingTime(null);
      fetchRelatedData();
    }
  }

  async function handleDeleteTime(tsId: string) {
    const { error } = await supabase.from('timesheets').delete().eq('id', tsId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Time entry deleted' });
      fetchRelatedData();
    }
  }

  async function handleUpdateExpense() {
    if (!editingExpense) return;
    
    const { error } = await supabase.from('expenses').update({
      date: editingExpense.date,
      amount: parseFloat(editingExpense.amount),
      description: editingExpense.description,
      category: editingExpense.category || null,
      is_billable: editingExpense.is_billable,
    }).eq('id', editingExpense.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Expense updated' });
      setEditingExpense(null);
      fetchRelatedData();
    }
  }

  async function handleDeleteExpense(expId: string) {
    const { error } = await supabase.from('expenses').delete().eq('id', expId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Expense deleted' });
      fetchRelatedData();
    }
  }

  async function handleConsumeInventory() {
    if (!newInventoryUsage.item_id || !newInventoryUsage.quantity) {
      toast({ title: 'Error', description: 'Item and quantity required', variant: 'destructive' });
      return;
    }

    const quantity = parseInt(newInventoryUsage.quantity);
    const selectedItem = allItems.find(i => i.id === newInventoryUsage.item_id);
    
    if (!selectedItem) {
      toast({ title: 'Error', description: 'Item not found', variant: 'destructive' });
      return;
    }

    // Check stock level
    if ((selectedItem.current_stock || 0) < quantity) {
      if (!confirm(`Warning: Only ${selectedItem.current_stock} units in stock. This will create negative stock. Continue?`)) {
        return;
      }
    }

    // Create inventory movement
    const { error: movementError } = await supabase.from('inventory_movements').insert({
      item_id: newInventoryUsage.item_id,
      job_id: id,
      movement_type: 'consume',
      quantity: -quantity, // Negative for consumption
      unit_cost: selectedItem.unit_cost,
      notes: newInventoryUsage.notes || `Used on job ${job.job_number}`,
      created_by: user?.id,
    });

    if (movementError) {
      toast({ title: 'Error', description: movementError.message, variant: 'destructive' });
      return;
    }

    // Update current stock
    const { error: updateError } = await supabase.from('items').update({
      current_stock: (selectedItem.current_stock || 0) - quantity,
    }).eq('id', selectedItem.id);

    if (updateError) {
      toast({ title: 'Error', description: updateError.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Success', description: `${quantity} x ${selectedItem.name} consumed` });
    setNewInventoryUsage({ item_id: '', quantity: '', notes: '' });
    setShowInventoryForm(false);
    fetchRelatedData();
    fetchAllItems(); // Refresh stock levels
  }

  async function handleDeleteInventoryMovement(movementId: string, itemId: string, quantity: number) {
    if (!confirm('Remove this inventory usage? Stock will be returned.')) return;

    // Get the item to restore stock
    const item = allItems.find(i => i.id === itemId);
    if (!item) return;

    // Delete the movement
    const { error: deleteError } = await supabase.from('inventory_movements').delete().eq('id', movementId);
    if (deleteError) {
      toast({ title: 'Error', description: deleteError.message, variant: 'destructive' });
      return;
    }

    // Restore stock (quantity is already negative, so subtracting it adds back)
    await supabase.from('items').update({
      current_stock: (item.current_stock || 0) - quantity,
    }).eq('id', itemId);

    toast({ title: 'Success', description: 'Inventory usage removed' });
    fetchRelatedData();
    fetchAllItems();
  }

  async function handleCreateInvoice() {
    if (!job.client_id) {
      toast({ title: 'Error', description: 'Job must have a client to create invoice', variant: 'destructive' });
      return;
    }

    // Allocate invoice number atomically so it's guaranteed unique
    const { data: numData, error: numErr } = await supabase.functions.invoke('allocate-invoice-number');
    if (numErr || !numData?.invoice_number) {
      toast({ title: 'Error', description: numErr?.message || 'Failed to allocate invoice number', variant: 'destructive' });
      return;
    }
    const invoiceNumber = numData.invoice_number;

    // Get unbilled time and expenses (billable AND not already on any invoice)
    const { data: existingLines } = await supabase
      .from('invoice_lines')
      .select('timesheet_id, expense_id');
    
    const invoicedTimesheetIds = new Set((existingLines || []).filter(l => l.timesheet_id).map(l => l.timesheet_id));
    const invoicedExpenseIds = new Set((existingLines || []).filter(l => l.expense_id).map(l => l.expense_id));
    
    const unbilledTime = timesheets.filter(ts => ts.is_billable && !invoicedTimesheetIds.has(ts.id));
    const unbilledExpenses = expenses.filter(exp => exp.is_billable && !invoicedExpenseIds.has(exp.id));

    // Calculate totals
    const timeTotal = unbilledTime.reduce((sum, ts) => sum + (ts.hours * (ts.rate_override || job.hourly_rate || 0)), 0);
    const expenseTotal = unbilledExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const subtotal = timeTotal + expenseTotal;
    const taxRate = 10; // Default GST
    const taxTotal = subtotal * (taxRate / 100);
    const total = subtotal + taxTotal;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        client_id: job.client_id,
        job_id: id,
        status: 'draft',
        subtotal,
        tax_total: taxTotal,
        total,
        due_date: dueDate.toISOString().split('T')[0],
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    // Create invoice lines for time entries
    const timeLines = unbilledTime.map((ts, idx) => ({
      invoice_id: invoice.id,
      description: `${ts.description || 'Time'} (${ts.date})`,
      quantity: ts.hours,
      unit: 'hours',
      unit_price: ts.rate_override || job.hourly_rate || 0,
      line_total: ts.hours * (ts.rate_override || job.hourly_rate || 0),
      tax_rate: taxRate,
      timesheet_id: ts.id,
      sort_order: idx,
    }));

    // Create invoice lines for expenses
    const expenseLines = unbilledExpenses.map((exp, idx) => ({
      invoice_id: invoice.id,
      description: exp.description,
      quantity: 1,
      unit: 'each',
      unit_price: exp.amount,
      line_total: exp.amount,
      tax_rate: taxRate,
      expense_id: exp.id,
      sort_order: timeLines.length + idx,
    }));

    const allLines = [...timeLines, ...expenseLines];
    if (allLines.length > 0) {
      await supabase.from('invoice_lines').insert(allLines);
    }

    // Note: the invoice number counter is now advanced atomically by the
    // allocate-invoice-number function at allocation time above, so there is
    // no separate client-side counter update here anymore.

    toast({ title: 'Success', description: 'Invoice created' });
    navigate(`/invoices/${invoice.id}`);
  }

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '$0.00';
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
  };

  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.amount_paid, 0);
  const totalTimeCost = timesheets.reduce((sum, ts) => sum + (ts.hours * (ts.rate_override || job.hourly_rate || 0)), 0);
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const profit = totalRevenue - totalTimeCost - totalExpenses;

  // Assets not already linked to this job and not assigned to a client
  const linkedAssetIds = new Set(jobAssets.map(ja => ja.asset_id));
  const availableAssets = allAssets.filter(a => !linkedAssetIds.has(a.id) && !a.assigned_client_id);

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/jobs">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {isNew ? 'New Job' : job.name}
          </h1>
          {!isNew && <p className="text-muted-foreground">{job.job_number}</p>}
        </div>
        <div className="flex gap-2">
          {!isNew && (
            <Button variant="destructive" size="icon" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {!isNew && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Time Costs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalTimeCost)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalExpenses)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(profit)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="details">
        <TabsList className="flex-wrap">
          <TabsTrigger value="details">Details</TabsTrigger>
          {!isNew && <TabsTrigger value="history">History</TabsTrigger>}
          {!isNew && <TabsTrigger value="assets">Assets ({jobAssets.length})</TabsTrigger>}
          {!isNew && <TabsTrigger value="inventory">Inventory ({inventoryMovements.length})</TabsTrigger>}
          {!isNew && <TabsTrigger value="time">Time ({timesheets.length})</TabsTrigger>}
          {!isNew && <TabsTrigger value="expenses">Expenses ({expenses.length})</TabsTrigger>}
          {!isNew && <TabsTrigger value="invoices">Invoices ({invoices.length})</TabsTrigger>}
        </TabsList>

        {!isNew && (
          <TabsContent value="history">
            <JobHistory jobId={id!} />
          </TabsContent>
        )}

        <TabsContent value="details" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Job Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="job_number">Job Number *</Label>
                  <Input
                    id="job_number"
                    value={job.job_number || ''}
                    onChange={(e) => setJob({ ...job, job_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Job Name *</Label>
                  <Input
                    id="name"
                    value={job.name || ''}
                    onChange={(e) => setJob({ ...job, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client">Client</Label>
                  <Select
                    value={job.client_id || ''}
                    onValueChange={(value) => setJob({ ...job, client_id: value || null })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {tradingNames.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="trading_name">Trading Name</Label>
                    <Select
                      value={(job as any).trading_name_id || ''}
                      onValueChange={(value) => setJob({ ...job, trading_name_id: value || null } as any)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select trading name" />
                      </SelectTrigger>
                      <SelectContent>
                        {tradingNames.map((tn) => (
                          <SelectItem key={tn.id} value={tn.id}>
                            {tn.name} {tn.is_default && '(Default)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <LocationSelector
                  value={job.location_id || null}
                  onChange={(locationId) => setJob({ ...job, location_id: locationId })}
                />
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={job.status || 'prospect'}
                    onValueChange={(value: any) => setJob({ ...job, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prospect">Prospect</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="complete">Complete</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={job.description || ''}
                    onChange={(e) => setJob({ ...job, description: e.target.value })}
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Dates & Budget</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Start Date</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={job.start_date || ''}
                      onChange={(e) => setJob({ ...job, start_date: e.target.value || null })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_date">End Date</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={job.end_date || ''}
                      onChange={(e) => setJob({ ...job, end_date: e.target.value || null })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget">Budget</Label>
                  <Input
                    id="budget"
                    type="number"
                    step="0.01"
                    value={job.budget || ''}
                    onChange={(e) => setJob({ ...job, budget: parseFloat(e.target.value) || null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hourly_rate">Hourly Rate</Label>
                  <Input
                    id="hourly_rate"
                    type="number"
                    step="0.01"
                    value={job.hourly_rate || ''}
                    onChange={(e) => setJob({ ...job, hourly_rate: parseFloat(e.target.value) || null })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recurring Billing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_recurring"
                    checked={job.is_recurring || false}
                    onCheckedChange={(checked) => setJob({ ...job, is_recurring: !!checked })}
                  />
                  <Label htmlFor="is_recurring">Enable recurring billing</Label>
                </div>
                
                {job.is_recurring && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="recurring_rate">Monthly Service Rate</Label>
                      <Input
                        id="recurring_rate"
                        type="number"
                        step="0.01"
                        value={job.recurring_rate || ''}
                        onChange={(e) => setJob({ ...job, recurring_rate: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="billing_day">Billing Day of Month</Label>
                        <Input
                          id="billing_day"
                          type="number"
                          min="1"
                          max="28"
                          value={job.billing_day || 1}
                          onChange={(e) => setJob({ ...job, billing_day: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="invoice_lead_days">Generate Invoice Days Before</Label>
                        <Input
                          id="invoice_lead_days"
                          type="number"
                          min="0"
                          max="30"
                          value={job.invoice_lead_days || 7}
                          onChange={(e) => setJob({ ...job, invoice_lead_days: parseInt(e.target.value) || 7 })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="next_invoice_date">Next Invoice Date</Label>
                      <Input
                        id="next_invoice_date"
                        type="date"
                        value={job.next_invoice_date || ''}
                        onChange={(e) => setJob({ ...job, next_invoice_date: e.target.value || null })}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="assets">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Asset Rentals</CardTitle>
              <Button size="sm" onClick={() => setShowAssetForm(!showAssetForm)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Asset Rental
              </Button>
            </CardHeader>
            <CardContent>
              {showAssetForm && (
                <div className="mb-4 p-4 border rounded-lg bg-muted/50 space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-base font-semibold">New Asset Rental</Label>
                    <Button variant="ghost" size="sm" onClick={() => { setShowAssetForm(false); setAssetConflictWarning(null); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {assetConflictWarning && (
                    <Alert variant={assetConflictWarning.type === 'blocked' ? 'destructive' : 'default'}>
                      {assetConflictWarning.type === 'blocked' ? (
                        <Ban className="h-4 w-4" />
                      ) : (
                        <AlertTriangle className="h-4 w-4" />
                      )}
                      <AlertDescription>{assetConflictWarning.message}</AlertDescription>
                    </Alert>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Asset *</Label>
                      <Select value={newJobAsset.asset_id} onValueChange={(v) => handleAssetFormChange({ asset_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select asset" /></SelectTrigger>
                        <SelectContent>
                          {availableAssets.map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.name} ({a.asset_tag})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Rental Rate ($) *</Label>
                      <Input type="number" step="0.01" value={newJobAsset.rental_rate} onChange={(e) => handleAssetFormChange({ rental_rate: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Start Date *</Label>
                      <Input type="date" value={newJobAsset.rental_start_date} onChange={(e) => handleAssetFormChange({ rental_start_date: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date (optional)</Label>
                      <Input type="date" value={newJobAsset.rental_end_date} onChange={(e) => handleAssetFormChange({ rental_end_date: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Billing Frequency</Label>
                      <Select value={newJobAsset.billing_frequency} onValueChange={(v) => handleAssetFormChange({ billing_frequency: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Billing Day (1-28)</Label>
                      <Input type="number" min="1" max="28" value={newJobAsset.billing_day} onChange={(e) => handleAssetFormChange({ billing_day: parseInt(e.target.value) || 1 })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Invoice Lead Days</Label>
                      <Input type="number" min="0" max="30" value={newJobAsset.invoice_lead_days} onChange={(e) => handleAssetFormChange({ invoice_lead_days: parseInt(e.target.value) || 7 })} />
                    </div>
                    <div className="space-y-2 flex items-center gap-3 pt-6">
                      <Switch
                        id="billing_in_advance"
                        checked={newJobAsset.billing_in_advance}
                        onCheckedChange={(checked) => handleAssetFormChange({ billing_in_advance: checked })}
                      />
                      <Label htmlFor="billing_in_advance">Bill in advance (for upcoming period)</Label>
                    </div>
                  </div>
                  <Button 
                    onClick={handleAddJobAsset}
                    disabled={assetConflictWarning?.type === 'blocked'}
                  >
                    {assetConflictWarning?.type === 'warning' ? 'Add Anyway' : 'Add Asset Rental'}
                  </Button>
                </div>
              )}

              {editingJobAsset && (
                <div className="mb-4 p-4 border rounded-lg bg-muted/50 space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-base font-semibold">Edit Asset Rental: {editingJobAsset.assets?.name}</Label>
                    <Button variant="ghost" size="sm" onClick={() => setEditingJobAsset(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Rental Rate ($)</Label>
                      <Input type="number" step="0.01" value={editingJobAsset.rental_rate} onChange={(e) => setEditingJobAsset({ ...editingJobAsset, rental_rate: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input type="date" value={editingJobAsset.rental_start_date} onChange={(e) => setEditingJobAsset({ ...editingJobAsset, rental_start_date: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input type="date" value={editingJobAsset.rental_end_date || ''} onChange={(e) => setEditingJobAsset({ ...editingJobAsset, rental_end_date: e.target.value || null })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Billing Frequency</Label>
                      <Select value={editingJobAsset.billing_frequency} onValueChange={(v) => setEditingJobAsset({ ...editingJobAsset, billing_frequency: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Billing Day</Label>
                      <Input type="number" min="1" max="28" value={editingJobAsset.billing_day} onChange={(e) => setEditingJobAsset({ ...editingJobAsset, billing_day: parseInt(e.target.value) || 1 })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Invoice Lead Days</Label>
                      <Input type="number" min="0" max="30" value={editingJobAsset.invoice_lead_days} onChange={(e) => setEditingJobAsset({ ...editingJobAsset, invoice_lead_days: parseInt(e.target.value) || 7 })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Next Invoice Date</Label>
                      <Input type="date" value={editingJobAsset.next_invoice_date || ''} onChange={(e) => setEditingJobAsset({ ...editingJobAsset, next_invoice_date: e.target.value || null })} />
                    </div>
                    <div className="space-y-2 flex items-center gap-3 pt-6">
                      <Switch
                        id="edit_billing_in_advance"
                        checked={editingJobAsset.billing_in_advance || false}
                        onCheckedChange={(checked) => setEditingJobAsset({ ...editingJobAsset, billing_in_advance: checked })}
                      />
                      <Label htmlFor="edit_billing_in_advance">Bill in advance</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="ja_active"
                        checked={editingJobAsset.is_active}
                        onCheckedChange={(checked) => setEditingJobAsset({ ...editingJobAsset, is_active: !!checked })}
                      />
                      <Label htmlFor="ja_active">Active</Label>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleUpdateJobAsset}>Save Changes</Button>
                    <Button variant="outline" onClick={() => setEditingJobAsset(null)}>Cancel</Button>
                  </div>
                </div>
              )}

              {jobAssets.length === 0 ? (
                <p className="text-muted-foreground">No assets linked to this job</p>
              ) : (
                <div className="space-y-2">
                  {jobAssets.map((ja) => (
                    <div key={ja.id} className={`flex justify-between items-center p-3 rounded-lg hover:bg-muted ${!ja.is_active ? 'opacity-50' : ''}`}>
                      <div className="flex-1">
                        <Link to={`/assets/${ja.asset_id}`} className="font-medium hover:underline">
                          {ja.assets?.name} ({ja.assets?.asset_tag})
                        </Link>
                        <div className="text-sm text-muted-foreground">
                          {formatCurrency(ja.rental_rate)}/{ja.billing_frequency} • 
                          Started {ja.rental_start_date}
                          {ja.rental_end_date && ` • Ends ${ja.rental_end_date}`}
                          {!ja.is_active && ' • Inactive'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Next invoice: {ja.next_invoice_date || 'Not set'}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditingJobAsset(ja)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteJobAsset(ja.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="time">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Time Entries</CardTitle>
              <Button size="sm" onClick={() => setShowTimeForm(!showTimeForm)}>
                <Plus className="h-4 w-4 mr-2" />
                Log Time
              </Button>
            </CardHeader>
            <CardContent>
              {showTimeForm && (
                <div className="mb-4 p-4 border rounded-lg bg-muted/50 space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-base font-semibold">New Time Entry</Label>
                    <Button variant="ghost" size="sm" onClick={() => setShowTimeForm(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input type="date" value={newTime.date} onChange={(e) => setNewTime({ ...newTime, date: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Hours</Label>
                      <Input type="number" step="0.25" value={newTime.hours} onChange={(e) => setNewTime({ ...newTime, hours: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={newTime.description} onChange={(e) => setNewTime({ ...newTime, description: e.target.value })} />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="time_billable" checked={newTime.is_billable} onCheckedChange={(c) => setNewTime({ ...newTime, is_billable: !!c })} />
                    <Label htmlFor="time_billable">Billable</Label>
                  </div>
                  <Button onClick={handleAddTime}>Add Time</Button>
                </div>
              )}

              {editingTime && (
                <div className="mb-4 p-4 border rounded-lg bg-muted/50 space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-base font-semibold">Edit Time Entry</Label>
                    <Button variant="ghost" size="sm" onClick={() => setEditingTime(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input type="date" value={editingTime.date} onChange={(e) => setEditingTime({ ...editingTime, date: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Hours</Label>
                      <Input type="number" step="0.25" value={editingTime.hours} onChange={(e) => setEditingTime({ ...editingTime, hours: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={editingTime.description || ''} onChange={(e) => setEditingTime({ ...editingTime, description: e.target.value })} />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="edit_billable" checked={editingTime.is_billable} onCheckedChange={(c) => setEditingTime({ ...editingTime, is_billable: !!c })} />
                    <Label htmlFor="edit_billable">Billable</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleUpdateTime}>Save</Button>
                    <Button variant="outline" onClick={() => setEditingTime(null)}>Cancel</Button>
                  </div>
                </div>
              )}

              {timesheets.length === 0 ? (
                <p className="text-muted-foreground">No time entries</p>
              ) : (
                <div className="space-y-2">
                  {timesheets.map((ts) => {
                    const isLocked = lockedTimesheetIds.has(ts.id);
                    return (
                      <div key={ts.id} className={`flex justify-between items-center p-3 rounded-lg hover:bg-muted ${isLocked ? 'opacity-60' : ''}`}>
                        <div>
                          <div className="font-medium">{ts.hours} hours - {ts.date}</div>
                          <div className="text-sm text-muted-foreground">
                            {ts.description || 'No description'} • {ts.user_name}
                            {ts.is_billable && <span className="ml-2 text-green-600">Billable</span>}
                            {isLocked && <span className="ml-2 text-amber-600">Invoiced</span>}
                          </div>
                        </div>
                        {!isLocked && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setEditingTime(ts)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteTime(ts.id)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Expenses</CardTitle>
              <Button size="sm" onClick={() => setShowExpenseForm(!showExpenseForm)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Expense
              </Button>
            </CardHeader>
            <CardContent>
              {showExpenseForm && (
                <div className="mb-4 p-4 border rounded-lg bg-muted/50 space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-base font-semibold">New Expense</Label>
                    <Button variant="ghost" size="sm" onClick={() => setShowExpenseForm(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input type="date" value={newExpense.date} onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input type="number" step="0.01" value={newExpense.amount} onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Input value={newExpense.category} onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={newExpense.description} onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })} />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="exp_billable" checked={newExpense.is_billable} onCheckedChange={(c) => setNewExpense({ ...newExpense, is_billable: !!c })} />
                    <Label htmlFor="exp_billable">Billable</Label>
                  </div>
                  <Button onClick={handleAddExpense}>Add Expense</Button>
                </div>
              )}

              {editingExpense && (
                <div className="mb-4 p-4 border rounded-lg bg-muted/50 space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-base font-semibold">Edit Expense</Label>
                    <Button variant="ghost" size="sm" onClick={() => setEditingExpense(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input type="date" value={editingExpense.date} onChange={(e) => setEditingExpense({ ...editingExpense, date: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input type="number" step="0.01" value={editingExpense.amount} onChange={(e) => setEditingExpense({ ...editingExpense, amount: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Input value={editingExpense.category || ''} onChange={(e) => setEditingExpense({ ...editingExpense, category: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={editingExpense.description} onChange={(e) => setEditingExpense({ ...editingExpense, description: e.target.value })} />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="edit_exp_billable" checked={editingExpense.is_billable} onCheckedChange={(c) => setEditingExpense({ ...editingExpense, is_billable: !!c })} />
                    <Label htmlFor="edit_exp_billable">Billable</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleUpdateExpense}>Save</Button>
                    <Button variant="outline" onClick={() => setEditingExpense(null)}>Cancel</Button>
                  </div>
                </div>
              )}

              {expenses.length === 0 ? (
                <p className="text-muted-foreground">No expenses</p>
              ) : (
                <div className="space-y-2">
                  {expenses.map((exp) => {
                    const isLocked = lockedExpenseIds.has(exp.id);
                    return (
                      <div key={exp.id} className={`flex justify-between items-center p-3 rounded-lg hover:bg-muted ${isLocked ? 'opacity-60' : ''}`}>
                        <div>
                          <div className="font-medium">{formatCurrency(exp.amount)} - {exp.date}</div>
                          <div className="text-sm text-muted-foreground">
                            {exp.description}
                            {exp.category && ` • ${exp.category}`}
                            {exp.is_billable && <span className="ml-2 text-green-600">Billable</span>}
                            {isLocked && <span className="ml-2 text-amber-600">Invoiced</span>}
                          </div>
                        </div>
                        {!isLocked && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setEditingExpense(exp)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteExpense(exp.id)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Inventory Usage</CardTitle>
              <Button size="sm" onClick={() => setShowInventoryForm(!showInventoryForm)}>
                <Package className="h-4 w-4 mr-2" />
                Use Inventory
              </Button>
            </CardHeader>
            <CardContent>
              {showInventoryForm && (
                <div className="mb-4 p-4 border rounded-lg bg-muted/50 space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-base font-semibold">Consume Inventory Item</Label>
                    <Button variant="ghost" size="sm" onClick={() => setShowInventoryForm(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Item</Label>
                      <Select
                        value={newInventoryUsage.item_id}
                        onValueChange={(value) => setNewInventoryUsage({ ...newInventoryUsage, item_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select item" />
                        </SelectTrigger>
                        <SelectContent>
                          {allItems.map((item) => {
                            const isLowStock = (item.current_stock || 0) <= (item.reorder_level || 0);
                            return (
                              <SelectItem key={item.id} value={item.id}>
                                <div className="flex items-center gap-2">
                                  {item.name} ({item.current_stock} in stock)
                                  {isLowStock && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input 
                        type="number" 
                        min="1"
                        value={newInventoryUsage.quantity} 
                        onChange={(e) => setNewInventoryUsage({ ...newInventoryUsage, quantity: e.target.value })} 
                      />
                    </div>
                  </div>
                  {newInventoryUsage.item_id && (() => {
                    const selectedItem = allItems.find(i => i.id === newInventoryUsage.item_id);
                    if (selectedItem && (selectedItem.current_stock || 0) <= (selectedItem.reorder_level || 0)) {
                      return (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            Low stock warning: Only {selectedItem.current_stock} units available (reorder level: {selectedItem.reorder_level})
                          </AlertDescription>
                        </Alert>
                      );
                    }
                    return null;
                  })()}
                  <div className="space-y-2">
                    <Label>Notes (optional)</Label>
                    <Input 
                      value={newInventoryUsage.notes} 
                      onChange={(e) => setNewInventoryUsage({ ...newInventoryUsage, notes: e.target.value })}
                      placeholder="Reason for usage"
                    />
                  </div>
                  <Button onClick={handleConsumeInventory}>Consume</Button>
                </div>
              )}

              {inventoryMovements.length === 0 ? (
                <p className="text-muted-foreground">No inventory used on this job</p>
              ) : (
                <div className="space-y-2">
                  {inventoryMovements.map((mov) => (
                    <div key={mov.id} className="flex justify-between items-center p-3 rounded-lg hover:bg-muted">
                      <div>
                        <div className="font-medium">
                          {Math.abs(mov.quantity)} x {(mov as any).items?.name || 'Unknown Item'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(mov.created_at).toLocaleDateString()}
                          {mov.notes && ` • ${mov.notes}`}
                          {mov.unit_cost && ` • ${formatCurrency(Math.abs(mov.quantity) * mov.unit_cost)}`}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDeleteInventoryMovement(mov.id, mov.item_id, mov.quantity)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Invoices</CardTitle>
              <Button size="sm" onClick={handleCreateInvoice}>
                <FileText className="h-4 w-4 mr-2" />
                Create Invoice
              </Button>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <p className="text-muted-foreground">No invoices</p>
              ) : (
                <div className="space-y-2">
                  {invoices.map((inv) => (
                    <Link
                      key={inv.id}
                      to={`/invoices/${inv.id}`}
                      className="flex justify-between items-center p-3 rounded-lg hover:bg-muted"
                    >
                      <div>
                        <div className="font-medium">{inv.invoice_number}</div>
                        <div className="text-sm text-muted-foreground">
                          {inv.issue_date} • Due {inv.due_date}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(inv.total)}</div>
                        <div className={`text-sm ${
                          inv.status === 'paid' ? 'text-green-600' :
                          inv.status === 'overdue' ? 'text-red-600' :
                          'text-muted-foreground'
                        }`}>
                          {inv.status}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
