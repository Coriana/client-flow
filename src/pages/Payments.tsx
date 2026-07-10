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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, DollarSign, Receipt, Store, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';
import MakePaymentDialog from '@/components/MakePaymentDialog';
import EditPurchaseDialog from '@/components/EditPurchaseDialog';
import RecordPaymentDialog from '@/components/RecordPaymentDialog';

type Payment = Tables<'payments'> & {
  invoices?: { invoice_number: string; clients?: { name: string } | null } | null
};
type Purchase = Tables<'purchases'> & {
  vendors?: { name: string } | null
};

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [makePaymentOpen, setMakePaymentOpen] = useState(false);
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [editPurchaseOpen, setEditPurchaseOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const { toast } = useToast();

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
    const [paymentsRes, purchasesRes, vendorsRes] = await Promise.all([
      supabase
        .from('payments')
        .select('*, invoices(invoice_number, clients(name))')
        .order('date', { ascending: false }),
      supabase
        .from('purchases')
        .select('*, vendors(name)')
        .order('date', { ascending: false }),
      supabase
        .from('vendors')
        .select('id, name')
        .eq('is_active', true)
        .order('name'),
    ]);

    setPayments(paymentsRes.data || []);
    setPurchases(purchasesRes.data || []);
    setVendors(vendorsRes.data || []);
    setLoading(false);
  }

  function openEditPurchase(purchase: Purchase) {
    setSelectedPurchase(purchase);
    setEditPurchaseOpen(true);
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
            Pay Vendor
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Receive Payment
          </Button>
        </div>
      </div>

      <MakePaymentDialog
        open={makePaymentOpen}
        onOpenChange={setMakePaymentOpen}
        onSuccess={fetchData}
      />

      <RecordPaymentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
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
            <p className="text-xs text-muted-foreground">{payments.length} payment{payments.length === 1 ? '' : 's'} received</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expenses</CardTitle>
            <Receipt className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalSpent)}</div>
            <p className="text-xs text-muted-foreground">{purchases.length} payment{purchases.length === 1 ? '' : 's'} made</p>
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
                      No payments made yet. Click "Pay Vendor" to record an expense.
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
