import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Trash2, Plus, Mail, Download, Lock, Package } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Invoice = Tables<'invoices'>;
type InvoiceLine = Tables<'invoice_lines'>;
type Client = Tables<'clients'>;
type JobAsset = Tables<'job_assets'>;
type Asset = Tables<'assets'>;

interface TaxRate {
  id: string;
  name: string;
  rate: number;
  is_default: boolean;
  is_active: boolean;
}

interface LineItem extends Partial<InvoiceLine> {
  tempId?: string;
  job_asset_id?: string | null;
  tax_rate_id?: string | null;
  tax_name?: string | null;
}

interface JobAssetWithDetails extends JobAsset {
  assets?: Asset;
  jobs?: { name: string; job_number: string };
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = id === 'new';
  
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [availableJobAssets, setAvailableJobAssets] = useState<JobAssetWithDetails[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [defaultTaxRate, setDefaultTaxRate] = useState<TaxRate | null>(null);
  const [companySettings, setCompanySettings] = useState<{ default_tax_rate: number; default_payment_terms: number; default_tax_rate_id: string | null }>({ default_tax_rate: 10, default_payment_terms: 30, default_tax_rate_id: null });
  const [invoice, setInvoice] = useState<Partial<Invoice>>({
    invoice_number: '',
    client_id: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: '',
    status: 'draft',
    notes: '',
    terms: '',
    subtotal: 0,
    tax_total: 0,
    total: 0,
    amount_paid: 0,
  });
  const [lines, setLines] = useState<LineItem[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [clientCredit, setClientCredit] = useState<number>(0);
  const [showAssetSelector, setShowAssetSelector] = useState(false);

  const isDraft = invoice.status === 'draft';
  const isEditable = isNew || isDraft;

  // Get available status transitions based on current status
  function getAvailableStatuses(currentStatus: string): { value: string; label: string }[] {
    switch (currentStatus) {
      case 'draft':
        return [
          { value: 'draft', label: 'Draft' },
          { value: 'sent', label: 'Sent' },
          { value: 'void', label: 'Void' },
        ];
      case 'sent':
        return [
          { value: 'sent', label: 'Sent' },
          { value: 'partially_paid', label: 'Partially Paid' },
          { value: 'paid', label: 'Paid' },
          { value: 'overdue', label: 'Overdue' },
          { value: 'void', label: 'Void' },
          { value: 'written_off', label: 'Written Off (Bad Debt)' },
        ];
      case 'partially_paid':
        return [
          { value: 'partially_paid', label: 'Partially Paid' },
          { value: 'paid', label: 'Paid' },
          { value: 'overdue', label: 'Overdue' },
          { value: 'void', label: 'Void' },
          { value: 'written_off', label: 'Written Off (Bad Debt)' },
        ];
      case 'overdue':
        return [
          { value: 'overdue', label: 'Overdue' },
          { value: 'partially_paid', label: 'Partially Paid' },
          { value: 'paid', label: 'Paid' },
          { value: 'void', label: 'Void' },
          { value: 'written_off', label: 'Written Off (Bad Debt)' },
        ];
      case 'paid':
        return [
          { value: 'paid', label: 'Paid' },
          { value: 'void', label: 'Void' },
        ];
      case 'void':
        return [
          { value: 'void', label: 'Void' },
        ];
      case 'written_off':
        return [
          { value: 'written_off', label: 'Written Off (Bad Debt)' },
        ];
      default:
        return [{ value: currentStatus, label: currentStatus }];
    }
  }

  useEffect(() => {
    fetchClients();
    fetchCompanySettings();
    fetchTaxRates();
    if (!isNew && id) {
      fetchInvoice();
    } else {
      generateInvoiceNumber();
    }
  }, [id, isNew]);

  useEffect(() => {
    if (invoice.client_id) {
      const selectedClient = clients.find(c => c.id === invoice.client_id);
      if (selectedClient) {
        setClient(selectedClient);
        fetchAvailableJobAssets(invoice.client_id);
        fetchClientCredit(invoice.client_id);
        if (isNew && !invoice.due_date) {
          const issueDate = new Date(invoice.issue_date || new Date());
          const paymentTerms = selectedClient.payment_terms || companySettings.default_payment_terms;
          issueDate.setDate(issueDate.getDate() + paymentTerms);
          setInvoice(prev => ({ ...prev, due_date: issueDate.toISOString().split('T')[0] }));
        }
      }
    }
  }, [invoice.client_id, clients, companySettings]);

  async function fetchClientCredit(clientId: string) {
    // Calculate credit from overpaid invoices (amount_paid > total on paid invoices)
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, total, amount_paid, status')
      .eq('client_id', clientId)
      .in('status', ['paid', 'partially_paid', 'sent', 'overdue']);
    
    if (!invoices) {
      setClientCredit(0);
      return;
    }
    
    // Calculate total credit (sum of overpayments)
    const credit = invoices.reduce((sum, inv) => {
      const overpayment = (inv.amount_paid || 0) - (inv.total || 0);
      return sum + (overpayment > 0 ? overpayment : 0);
    }, 0);
    
    setClientCredit(credit);
  }

  async function fetchAvailableJobAssets(clientId: string) {
    // Get job assets for jobs belonging to this client that haven't been invoiced yet
    const { data: jobs } = await supabase
      .from('jobs')
      .select('id')
      .eq('client_id', clientId);
    
    if (!jobs || jobs.length === 0) {
      setAvailableJobAssets([]);
      return;
    }

    const jobIds = jobs.map(j => j.id);
    
    // Get all job assets for these jobs
    const { data: jobAssets } = await supabase
      .from('job_assets')
      .select('*, assets(*), jobs(name, job_number)')
      .in('job_id', jobIds)
      .eq('is_active', true);

    if (!jobAssets) {
      setAvailableJobAssets([]);
      return;
    }

    // Get already invoiced job_asset_ids (on non-void invoices)
    const { data: invoicedLines } = await supabase
      .from('invoice_lines')
      .select('job_asset_id, invoice_id, invoices(status)')
      .not('job_asset_id', 'is', null);

    const invoicedJobAssetIds = new Set(
      (invoicedLines || [])
        .filter(l => l.invoices && (l.invoices as any).status !== 'void')
        .map(l => l.job_asset_id)
    );

    // Also exclude job assets already added to current invoice lines
    const currentLineJobAssetIds = new Set(lines.filter(l => l.job_asset_id).map(l => l.job_asset_id));

    // Filter to only show uninvoiced job assets
    const available = jobAssets.filter(ja => 
      !invoicedJobAssetIds.has(ja.id) && !currentLineJobAssetIds.has(ja.id)
    );

    setAvailableJobAssets(available as JobAssetWithDetails[]);
  }

  async function generateInvoiceNumber() {
    const { data: settings } = await supabase
      .from('company_settings')
      .select('invoice_prefix, invoice_next_number')
      .limit(1)
      .single();
    
    const prefix = settings?.invoice_prefix || 'INV';
    const nextNum = settings?.invoice_next_number || 1;
    
    setInvoice(prev => ({
      ...prev,
      invoice_number: `${prefix}-${String(nextNum).padStart(5, '0')}`
    }));
  }

  async function fetchClients() {
    const { data } = await supabase.from('clients').select('*').eq('is_active', true).order('name');
    setClients(data || []);
  }

  async function fetchCompanySettings() {
    const { data } = await supabase.from('company_settings').select('default_tax_rate, default_payment_terms, default_tax_rate_id').limit(1).single();
    if (data) {
      setCompanySettings({
        default_tax_rate: data.default_tax_rate ?? 10,
        default_payment_terms: data.default_payment_terms ?? 30,
        default_tax_rate_id: data.default_tax_rate_id ?? null,
      });
    }
  }

  async function fetchTaxRates() {
    const { data } = await supabase.from('tax_rates').select('*').eq('is_active', true).order('is_default', { ascending: false }).order('name');
    setTaxRates(data || []);
    const defaultRate = (data || []).find(r => r.is_default);
    if (defaultRate) {
      setDefaultTaxRate(defaultRate);
    }
  }

  async function fetchInvoice() {
    const [invRes, linesRes] = await Promise.all([
      supabase.from('invoices').select('*').eq('id', id).single(),
      supabase.from('invoice_lines').select('*').eq('invoice_id', id).order('sort_order'),
    ]);
    
    if (invRes.error) {
      toast({ title: 'Error', description: 'Invoice not found', variant: 'destructive' });
      navigate('/invoices');
    } else {
      setInvoice(invRes.data);
      setLines(linesRes.data || []);
    }
    setLoading(false);
  }

  function addLine() {
    if (!isEditable) return;
    const taxRate = defaultTaxRate || taxRates[0];
    setLines([...lines, {
      tempId: Math.random().toString(),
      description: '',
      quantity: 1,
      unit_price: 0,
      tax_rate: taxRate?.rate || 0,
      tax_rate_id: taxRate?.id || null,
      tax_name: taxRate?.name || null,
      line_total: 0,
    }]);
  }

  function addJobAssetLine(jobAsset: JobAssetWithDetails) {
    if (!isEditable) return;
    
    const taxRate = defaultTaxRate || taxRates[0];
    const description = `Asset Rental: ${jobAsset.assets?.name || 'Asset'} (${jobAsset.billing_frequency})`;
    const quantity = 1;
    const unitPrice = jobAsset.rental_rate;
    const taxRateValue = taxRate?.rate || 0;
    const subtotal = quantity * unitPrice;
    const lineTotal = subtotal + (subtotal * taxRateValue / 100);
    
    const newLine: LineItem = {
      tempId: Math.random().toString(),
      description,
      quantity,
      unit_price: unitPrice,
      tax_rate: taxRateValue,
      tax_rate_id: taxRate?.id || null,
      tax_name: taxRate?.name || null,
      line_total: lineTotal,
      job_asset_id: jobAsset.id,
    };
    
    const newLines = [...lines, newLine];
    setLines(newLines);
    recalculateTotals(newLines);
    setShowAssetSelector(false);
    
    // Remove from available list
    setAvailableJobAssets(prev => prev.filter(ja => ja.id !== jobAsset.id));
  }

  function updateLine(index: number, updates: Partial<LineItem>) {
    if (!isEditable) return;
    const newLines = [...lines];
    const line = { ...newLines[index], ...updates };
    
    // If tax_rate_id changed, update tax_rate and tax_name
    if (updates.tax_rate_id !== undefined) {
      const selectedTax = taxRates.find(t => t.id === updates.tax_rate_id);
      if (selectedTax) {
        line.tax_rate = selectedTax.rate;
        line.tax_name = selectedTax.name;
      }
    }
    
    const qty = line.quantity || 0;
    const price = line.unit_price || 0;
    const taxRateValue = line.tax_rate || 0;
    const subtotal = qty * price;
    line.line_total = subtotal + (subtotal * taxRateValue / 100);
    
    newLines[index] = line;
    setLines(newLines);
    recalculateTotals(newLines);
  }

  function removeLine(index: number) {
    if (!isEditable) return;
    const newLines = lines.filter((_, i) => i !== index);
    setLines(newLines);
    recalculateTotals(newLines);
  }

  function recalculateTotals(currentLines: LineItem[]) {
    const subtotal = currentLines.reduce((sum, line) => {
      return sum + ((line.quantity || 0) * (line.unit_price || 0));
    }, 0);
    
    const taxTotal = currentLines.reduce((sum, line) => {
      const lineSubtotal = (line.quantity || 0) * (line.unit_price || 0);
      return sum + (lineSubtotal * (line.tax_rate || 0) / 100);
    }, 0);
    
    setInvoice(prev => ({
      ...prev,
      subtotal,
      tax_total: taxTotal,
      total: subtotal + taxTotal,
    }));
  }

  async function handleSave() {
    setSaving(true);
    
    if (!invoice.client_id || !invoice.invoice_number) {
      toast({ title: 'Error', description: 'Account and Invoice Number are required', variant: 'destructive' });
      setSaving(false);
      return;
    }

    if (isNew) {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('invoices')
        .insert({ ...invoice, created_by: userData.user?.id } as any)
        .select()
        .single();
      
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        setSaving(false);
        return;
      }

      // Insert lines
      if (lines.length > 0) {
        const linesToInsert = lines.map((line, index) => ({
          invoice_id: data.id,
          description: line.description || '',
          quantity: line.quantity || 1,
          unit_price: line.unit_price || 0,
          tax_rate: line.tax_rate || 0,
          tax_rate_id: line.tax_rate_id || null,
          tax_name: line.tax_name || null,
          line_total: line.line_total || 0,
          sort_order: index,
          timesheet_id: line.timesheet_id || null,
          expense_id: line.expense_id || null,
          job_asset_id: line.job_asset_id || null,
        }));
        
        await supabase.from('invoice_lines').insert(linesToInsert);
      }

      // Update next invoice number
      await supabase
        .from('company_settings')
        .update({ invoice_next_number: (parseInt(invoice.invoice_number?.split('-').pop() || '0') || 0) + 1 })
        .neq('id', '00000000-0000-0000-0000-000000000000');

      toast({ title: 'Success', description: 'Invoice created' });
      navigate(`/invoices/${data.id}`);
    } else {
      // For non-draft invoices, only allow status update
      const updateData = isDraft ? invoice : { status: invoice.status };
      
      const { error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', id);
      
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        setSaving(false);
        return;
      }

      // Only update lines for draft invoices
      if (isDraft) {
        const { error: deleteError } = await supabase.from('invoice_lines').delete().eq('invoice_id', id);
        if (deleteError) {
          toast({ title: 'Error', description: `Failed to update lines: ${deleteError.message}`, variant: 'destructive' });
          setSaving(false);
          return;
        }
        
        if (lines.length > 0) {
          const linesToInsert = lines.map((line, index) => ({
            invoice_id: id,
            description: line.description || '',
            quantity: line.quantity || 1,
            unit_price: line.unit_price || 0,
            tax_rate: line.tax_rate || 0,
            tax_rate_id: line.tax_rate_id || null,
            tax_name: line.tax_name || null,
            line_total: line.line_total || 0,
            sort_order: index,
            timesheet_id: line.timesheet_id || null,
            expense_id: line.expense_id || null,
            job_asset_id: line.job_asset_id || null,
          }));
          
          const { error: insertError } = await supabase.from('invoice_lines').insert(linesToInsert);
          if (insertError) {
            toast({ title: 'Error', description: `Failed to add lines: ${insertError.message}`, variant: 'destructive' });
            setSaving(false);
            return;
          }
        }
      }

      toast({ title: 'Success', description: 'Invoice updated' });
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!isDraft) {
      toast({ title: 'Error', description: 'Only draft invoices can be deleted. Use Void for sent invoices.', variant: 'destructive' });
      return;
    }
    if (!confirm('Are you sure you want to delete this invoice?')) return;
    
    await supabase.from('invoice_lines').delete().eq('invoice_id', id);
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Invoice deleted' });
      navigate('/invoices');
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
  };

  async function handleDownloadPdf() {
    toast({ title: 'Generating PDF...', description: 'Please wait' });
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-invoice-pdf', {
        body: { invoiceId: id }
      });
      
      if (error) throw error;
      
      // Create blob from HTML and open print dialog
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(data.html);
        printWindow.document.close();
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  }

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  const availableStatuses = getAvailableStatuses(invoice.status || 'draft');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/invoices">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {isNew ? 'New Invoice' : invoice.invoice_number}
          </h1>
          {!isEditable && (
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <Lock className="h-3 w-3" />
              This invoice is locked. Only status can be changed.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {!isNew && (
            <>
              <Button variant="outline" onClick={handleDownloadPdf}>
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" size="icon">
                <Mail className="h-4 w-4" />
              </Button>
              {isDraft && (
                <Button variant="destructive" size="icon" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invoice_number">Invoice Number *</Label>
                  <Input
                    id="invoice_number"
                    value={invoice.invoice_number || ''}
                    onChange={(e) => setInvoice({ ...invoice, invoice_number: e.target.value })}
                    disabled={!isEditable}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={invoice.status || 'draft'}
                    onValueChange={(value: any) => setInvoice({ ...invoice, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableStatuses.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="client">Account *</Label>
                <Select
                  value={invoice.client_id || ''}
                  onValueChange={(value) => setInvoice({ ...invoice, client_id: value })}
                  disabled={!isEditable}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="issue_date">Issue Date</Label>
                  <Input
                    id="issue_date"
                    type="date"
                    value={invoice.issue_date || ''}
                    onChange={(e) => setInvoice({ ...invoice, issue_date: e.target.value })}
                    disabled={!isEditable}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={invoice.due_date || ''}
                    onChange={(e) => setInvoice({ ...invoice, due_date: e.target.value })}
                    disabled={!isEditable}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Line Items</CardTitle>
              {isEditable && (
                <div className="flex gap-2">
                  {availableJobAssets.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => setShowAssetSelector(!showAssetSelector)}>
                      <Package className="h-4 w-4 mr-2" />
                      Add Asset Rental
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={addLine}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Line
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {showAssetSelector && isEditable && availableJobAssets.length > 0 && (
                <div className="mb-4 p-4 border rounded-lg bg-muted/50 space-y-3">
                  <Label className="text-base font-semibold">Select Asset Rental to Add</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {availableJobAssets.map(ja => (
                      <div 
                        key={ja.id} 
                        className="flex justify-between items-center p-2 rounded hover:bg-muted cursor-pointer"
                        onClick={() => addJobAssetLine(ja)}
                      >
                        <div>
                          <div className="font-medium">{ja.assets?.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {ja.jobs?.job_number} - {formatCurrency(ja.rental_rate)}/{ja.billing_frequency}
                          </div>
                        </div>
                        <Button size="sm" variant="ghost">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setShowAssetSelector(false)}>
                    Cancel
                  </Button>
                </div>
              )}
              <div className="space-y-4">
                {lines.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No line items</p>
                ) : (
                  lines.map((line, index) => (
                    <div key={line.id || line.tempId} className="grid gap-2 p-4 border rounded-lg">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label>Description</Label>
                          {line.job_asset_id && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Asset Rental</span>
                          )}
                          {line.timesheet_id && (
                            <span className="text-xs bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded">Time</span>
                          )}
                          {line.expense_id && (
                            <span className="text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded">Expense</span>
                          )}
                        </div>
                        <Input
                          value={line.description || ''}
                          onChange={(e) => updateLine(index, { description: e.target.value })}
                          disabled={!isEditable}
                        />
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="space-y-2">
                          <Label>Qty</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={line.quantity || ''}
                            onChange={(e) => updateLine(index, { quantity: parseFloat(e.target.value) || 0 })}
                            disabled={!isEditable}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Unit Price</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={line.unit_price || ''}
                            onChange={(e) => updateLine(index, { unit_price: parseFloat(e.target.value) || 0 })}
                            disabled={!isEditable}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Tax</Label>
                          <Select
                            value={line.tax_rate_id || 'none'}
                            onValueChange={(value) => updateLine(index, { tax_rate_id: value === 'none' ? null : value })}
                            disabled={!isEditable}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={line.tax_name ? `${line.tax_name} (${line.tax_rate}%)` : 'Select tax'} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Tax (0%)</SelectItem>
                              {taxRates.map((tr) => (
                                <SelectItem key={tr.id} value={tr.id}>
                                  {tr.name} ({tr.rate}%)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Total</Label>
                          <div className="h-10 flex items-center font-medium">
                            {formatCurrency(line.line_total || 0)}
                          </div>
                        </div>
                      </div>
                      {isEditable && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive"
                          onClick={() => removeLine(index)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes & Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={invoice.notes || ''}
                  onChange={(e) => setInvoice({ ...invoice, notes: e.target.value })}
                  rows={3}
                  disabled={!isEditable}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="terms">Terms</Label>
                <Textarea
                  id="terms"
                  value={invoice.terms || ''}
                  onChange={(e) => setInvoice({ ...invoice, terms: e.target.value })}
                  rows={3}
                  disabled={!isEditable}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(invoice.subtotal || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatCurrency(invoice.tax_total || 0)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-4">
                <span>Total</span>
                <span>{formatCurrency(invoice.total || 0)}</span>
              </div>
              {clientCredit > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Account Credit</span>
                  <span>-{formatCurrency(clientCredit)}</span>
                </div>
              )}
              {!isNew && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount Paid</span>
                    <span>{formatCurrency(invoice.amount_paid || 0)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Balance Due</span>
                    <span>{formatCurrency(Math.max(0, (invoice.total || 0) - (invoice.amount_paid || 0) - clientCredit))}</span>
                  </div>
                </>
              )}
              {isNew && clientCredit > 0 && (
                <div className="flex justify-between font-medium border-t pt-2">
                  <span>Net Due (after credit)</span>
                  <span>{formatCurrency(Math.max(0, (invoice.total || 0) - clientCredit))}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {client && (
            <Card>
              <CardHeader>
                <CardTitle>Bill To</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  <p className="font-medium">{client.name}</p>
                  {client.billing_address && (
                    <p className="text-muted-foreground whitespace-pre-line mt-1">
                      {client.billing_address}
                    </p>
                  )}
                  {client.contact_email && (
                    <p className="text-muted-foreground mt-1">{client.contact_email}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
