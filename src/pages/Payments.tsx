import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, DollarSign, Receipt, Store, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';
import MakePaymentDialog from '@/components/MakePaymentDialog';
import EditPurchaseDialog from '@/components/EditPurchaseDialog';

type Payment = Tables<'payments'> & { 
  invoices?: { invoice_number: string; clients?: { name: string } | null } | null 
};
type Invoice = Tables<'invoices'> & { clients?: { name: string } | null };
type Purchase = Tables<'purchases'> & { 
  vendors?: { name: string } | null 
};

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<{ id: string; name: string; current_balance: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [makePaymentOpen, setMakePaymentOpen] = useState(false);
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [editPurchaseOpen, setEditPurchaseOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [clientCredit, setClientCredit] = useState<number>(0);
  const [creditToApply, setCreditToApply] = useState<number>(0);
  const [overpaidInvoices, setOverpaidInvoices] = useState<{ id: string; overpayment: number }[]>([]);
  const { toast } = useToast();
  
  const [newPayment, setNewPayment] = useState({
    invoice_id: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    method: '',
    reference: '',
    notes: '',
    bank_account_id: '',
  });

  const [newVendor, setNewVendor] = useState({
    name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    notes: '',
  });


  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [paymentsRes, purchasesRes, invoicesRes, vendorsRes, bankRes] = await Promise.all([
      supabase
        .from('payments')
        .select('*, invoices(invoice_number, clients(name))')
        .order('date', { ascending: false }),
      supabase
        .from('purchases')
        .select('*, vendors(name)')
        .order('date', { ascending: false }),
      supabase
        .from('invoices')
        .select('*, clients(name)')
        .in('status', ['sent', 'partially_paid', 'overdue'])
        .order('invoice_number'),
      supabase
        .from('vendors')
        .select('id, name')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('bank_accounts')
        .select('id, name, current_balance')
        .eq('is_active', true)
        .order('name'),
    ]);
    
    setPayments(paymentsRes.data || []);
    setPurchases(purchasesRes.data || []);
    setInvoices(invoicesRes.data || []);
    setVendors(vendorsRes.data || []);
    setBankAccounts(bankRes.data || []);
    setLoading(false);
  }

  function openEditPurchase(purchase: Purchase) {
    setSelectedPurchase(purchase);
    setEditPurchaseOpen(true);
  }

  async function fetchClientCredit(clientId: string) {
    // Calculate credit from overpaid invoices (amount_paid > total on paid invoices)
    const { data: clientInvoices } = await supabase
      .from('invoices')
      .select('id, total, amount_paid, status')
      .eq('client_id', clientId)
      .in('status', ['paid', 'partially_paid', 'sent', 'overdue']);
    
    if (!clientInvoices) {
      setClientCredit(0);
      return { credit: 0, overpaidInvoices: [] };
    }
    
    // Find overpaid invoices and calculate total credit
    const overpaidInvoices = clientInvoices
      .filter(inv => (inv.amount_paid || 0) > (inv.total || 0))
      .map(inv => ({
        id: inv.id,
        overpayment: (inv.amount_paid || 0) - (inv.total || 0)
      }));
    
    const credit = overpaidInvoices.reduce((sum, inv) => sum + inv.overpayment, 0);
    
    setClientCredit(credit);
    return { credit, overpaidInvoices };
  }

  async function handleInvoiceSelect(invoiceId: string) {
    const invoice = invoices.find(i => i.id === invoiceId);
    if (!invoice) return;
    
    const amountDue = invoice.total - invoice.amount_paid;
    
    // Fetch client credit and overpaid invoices
    const result = await fetchClientCredit(invoice.client_id);
    setOverpaidInvoices(result.overpaidInvoices);
    
    // Auto-apply credit (capped at amount due)
    const creditApplied = Math.min(result.credit, amountDue);
    setCreditToApply(creditApplied);
    
    // Set payment amount to remaining after credit
    const paymentAmount = amountDue - creditApplied;
    
    setNewPayment({ 
      ...newPayment, 
      invoice_id: invoiceId,
      amount: paymentAmount
    });
  }

  async function handleAddPayment() {
    if (!newPayment.invoice_id) {
      toast({ title: 'Error', description: 'Invoice is required', variant: 'destructive' });
      return;
    }

    const totalApplied = newPayment.amount + creditToApply;
    if (totalApplied <= 0) {
      toast({ title: 'Error', description: 'Total payment (cash + credit) must be greater than 0', variant: 'destructive' });
      return;
    }

    const invoice = invoices.find(i => i.id === newPayment.invoice_id);
    if (!invoice) return;

    // If credit is being applied, reduce the overpaid invoices' amount_paid
    if (creditToApply > 0) {
      let remainingCreditToDeduct = creditToApply;
      
      // Deduct credit from overpaid invoices (FIFO order)
      for (const overpaidInv of overpaidInvoices) {
        if (remainingCreditToDeduct <= 0) break;
        
        const deductFromThis = Math.min(overpaidInv.overpayment, remainingCreditToDeduct);
        
        // Get current amount_paid for this invoice
        const { data: currentInv } = await supabase
          .from('invoices')
          .select('amount_paid, total')
          .eq('id', overpaidInv.id)
          .single();
        
        if (currentInv) {
          const newAmountPaid = currentInv.amount_paid - deductFromThis;
          const newStatus = newAmountPaid >= currentInv.total ? 'paid' : 'partially_paid';
          
          await supabase
            .from('invoices')
            .update({ amount_paid: newAmountPaid, status: newStatus })
            .eq('id', overpaidInv.id);
        }
        
        remainingCreditToDeduct -= deductFromThis;
      }

      // Record the credit payment on the target invoice
      const { data: userData } = await supabase.auth.getUser();
      const { error: creditError } = await supabase.from('payments').insert({
        invoice_id: newPayment.invoice_id,
        amount: creditToApply,
        date: newPayment.date,
        method: 'credit',
        reference: 'Credit applied from overpayment',
        notes: 'Automatic credit application',
        created_by: userData.user?.id,
      });
      
      if (creditError) {
        toast({ title: 'Error', description: creditError.message, variant: 'destructive' });
        return;
      }
    }

    // If there's a cash payment component, record it
    if (newPayment.amount > 0) {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from('payments').insert({ 
        invoice_id: newPayment.invoice_id,
        amount: newPayment.amount,
        date: newPayment.date,
        method: newPayment.method,
        reference: newPayment.reference,
        notes: newPayment.notes,
        created_by: userData.user?.id 
      });
      
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      
      // Update bank account balance if selected
      if (newPayment.bank_account_id) {
        const bankAccount = bankAccounts.find(b => b.id === newPayment.bank_account_id);
        if (bankAccount) {
          await supabase
            .from('bank_accounts')
            .update({ current_balance: bankAccount.current_balance + newPayment.amount })
            .eq('id', newPayment.bank_account_id);
        }
      }
    }

    // Update invoice amount_paid and status
    const newAmountPaid = invoice.amount_paid + totalApplied;
    const newStatus = newAmountPaid >= invoice.total ? 'paid' : 'partially_paid';
    
    await supabase
      .from('invoices')
      .update({ amount_paid: newAmountPaid, status: newStatus })
      .eq('id', newPayment.invoice_id);
    
    toast({ title: 'Success', description: 'Payment recorded' });
    setDialogOpen(false);
    setNewPayment({
      invoice_id: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      method: '',
      reference: '',
      notes: '',
      bank_account_id: '',
    });
    setClientCredit(0);
    setCreditToApply(0);
    setOverpaidInvoices([]);
    fetchData();
  }

  async function handleAddVendor() {
    if (!newVendor.name) {
      toast({ title: 'Error', description: 'Vendor name is required', variant: 'destructive' });
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('vendors').insert({ ...newVendor, user_id: userData.user?.id });
    
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Vendor added' });
      setVendorDialogOpen(false);
      setNewVendor({
        name: '',
        contact_name: '',
        contact_email: '',
        contact_phone: '',
        address: '',
        notes: '',
      });
    }
  }

  const filteredPayments = payments.filter(p => 
    p.invoices?.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
    p.invoices?.clients?.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.reference?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPurchases = purchases.filter(p => 
    p.description?.toLowerCase().includes(search.toLowerCase()) ||
    p.vendors?.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.vendor_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.reference?.toLowerCase().includes(search.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  };

  const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalSpent = purchases.reduce((sum, p) => sum + p.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground">Track income and expenses</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={vendorDialogOpen} onOpenChange={setVendorDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Store className="h-4 w-4 mr-2" />
                Add Vendor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Vendor</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={newVendor.name}
                    onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                    placeholder="Vendor name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Contact Name</Label>
                    <Input
                      value={newVendor.contact_name}
                      onChange={(e) => setNewVendor({ ...newVendor, contact_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={newVendor.contact_phone}
                      onChange={(e) => setNewVendor({ ...newVendor, contact_phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={newVendor.contact_email}
                    onChange={(e) => setNewVendor({ ...newVendor, contact_email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Textarea
                    value={newVendor.address}
                    onChange={(e) => setNewVendor({ ...newVendor, address: e.target.value })}
                  />
                </div>
                <Button className="w-full" onClick={handleAddVendor}>
                  Add Vendor
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={() => setMakePaymentOpen(true)}>
            <Receipt className="h-4 w-4 mr-2" />
            Make Payment
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setClientCredit(0);
              setCreditToApply(0);
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record Payment Received</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Invoice *</Label>
                  <Select
                    value={newPayment.invoice_id}
                    onValueChange={handleInvoiceSelect}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select invoice" />
                    </SelectTrigger>
                    <SelectContent>
                      {invoices.map((inv) => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {inv.invoice_number} - {inv.clients?.name} ({formatCurrency(inv.total - inv.amount_paid)} due)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Credit section - only show if there's credit available */}
                {newPayment.invoice_id && clientCredit > 0 && (
                  <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-green-700 dark:text-green-300">
                        Available Credit
                      </span>
                      <span className="font-semibold text-green-700 dark:text-green-300">
                        {formatCurrency(clientCredit)}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Credit to Apply</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max={Math.min(clientCredit, (invoices.find(i => i.id === newPayment.invoice_id)?.total || 0) - (invoices.find(i => i.id === newPayment.invoice_id)?.amount_paid || 0))}
                        value={creditToApply}
                        onChange={(e) => {
                          const invoice = invoices.find(i => i.id === newPayment.invoice_id);
                          if (!invoice) return;
                          const amountDue = invoice.total - invoice.amount_paid;
                          const newCredit = Math.min(parseFloat(e.target.value) || 0, clientCredit, amountDue);
                          setCreditToApply(newCredit);
                          // Adjust payment amount accordingly
                          setNewPayment({ ...newPayment, amount: amountDue - newCredit });
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        Set to 0 to pay the full amount without using credit
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cash/Bank Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newPayment.amount}
                      onChange={(e) => setNewPayment({ ...newPayment, amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={newPayment.date}
                      onChange={(e) => setNewPayment({ ...newPayment, date: e.target.value })}
                    />
                  </div>
                </div>

                {/* Payment summary */}
                {newPayment.invoice_id && (
                  <div className="p-3 bg-muted rounded-lg space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Amount Due:</span>
                      <span>{formatCurrency((invoices.find(i => i.id === newPayment.invoice_id)?.total || 0) - (invoices.find(i => i.id === newPayment.invoice_id)?.amount_paid || 0))}</span>
                    </div>
                    {creditToApply > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Credit Applied:</span>
                        <span>-{formatCurrency(creditToApply)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-medium pt-1 border-t">
                      <span>Cash/Bank Payment:</span>
                      <span>{formatCurrency(newPayment.amount)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-primary pt-1">
                      <span>Total Applied:</span>
                      <span>{formatCurrency(newPayment.amount + creditToApply)}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Method</Label>
                    <Select
                      value={newPayment.method}
                      onValueChange={(value) => setNewPayment({ ...newPayment, method: value })}
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
                      value={newPayment.reference}
                      onChange={(e) => setNewPayment({ ...newPayment, reference: e.target.value })}
                    />
                  </div>
                </div>
                
                {/* Bank Account Selection */}
                {bankAccounts.length > 0 && (
                  <div className="space-y-2">
                    <Label>Deposit To Bank Account</Label>
                    <Select
                      value={newPayment.bank_account_id}
                      onValueChange={(v) => setNewPayment({ ...newPayment, bank_account_id: v })}
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
                
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={newPayment.notes}
                    onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}
                  />
                </div>
                <Button className="w-full" onClick={handleAddPayment}>
                  Record Payment
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      <MakePaymentDialog 
        open={makePaymentOpen} 
        onOpenChange={setMakePaymentOpen} 
        onSuccess={fetchData} 
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Income</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalCollected)}</div>
            <p className="text-xs text-muted-foreground">{payments.length} payments received</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expenses</CardTitle>
            <Receipt className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalSpent)}</div>
            <p className="text-xs text-muted-foreground">{purchases.length} payments made</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalCollected - totalSpent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totalCollected - totalSpent)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Tabs defaultValue="received" className="space-y-4">
        <TabsList>
          <TabsTrigger value="received">Payments Received ({payments.length})</TabsTrigger>
          <TabsTrigger value="made">Payments Made ({purchases.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="received">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No payments found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{payment.date}</TableCell>
                      <TableCell>
                        <Link 
                          to={`/invoices/${payment.invoice_id}`}
                          className="font-medium hover:underline"
                        >
                          {payment.invoices?.invoice_number}
                        </Link>
                      </TableCell>
                      <TableCell>{payment.invoices?.clients?.name || '-'}</TableCell>
                      <TableCell className="capitalize">{payment.method?.replace('_', ' ') || '-'}</TableCell>
                      <TableCell>{payment.reference || '-'}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">+{formatCurrency(payment.amount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        
        <TabsContent value="made">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredPurchases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No payments made yet. Click "Make Payment" to record an expense.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPurchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell>{purchase.date}</TableCell>
                      <TableCell className="font-medium">{purchase.description}</TableCell>
                      <TableCell>{purchase.vendors?.name || purchase.vendor_name || '-'}</TableCell>
                      <TableCell className="capitalize">{purchase.payment_method?.replace('_', ' ') || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {purchase.reference || '-'}
                          {purchase.receipt_url && (
                            <a 
                              href={purchase.receipt_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline"
                            >
                              Receipt
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-600">-{formatCurrency(purchase.total)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => openEditPurchase(purchase)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Purchase Dialog - Using new comprehensive component */}
      <EditPurchaseDialog
        open={editPurchaseOpen}
        onOpenChange={setEditPurchaseOpen}
        onSuccess={fetchData}
        purchase={selectedPurchase}
      />
    </div>
  );
}
