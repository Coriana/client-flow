import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Plus, Edit, CreditCard, Package, Receipt, AlertTriangle, Users, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useBranding } from '@/contexts/BrandingContext';
import AffiliatedContacts from '@/components/AffiliatedContacts';
import LocationSelector from '@/components/LocationSelector';
import type { Tables } from '@/integrations/supabase/types';

type Vendor = Tables<'vendors'>;
type Item = Tables<'items'>;
type Purchase = Tables<'purchases'>;
type Issue = Tables<'issues'>;

export default function VendorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { formatCurrency } = useBranding();

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [creditAdjustment, setCreditAdjustment] = useState({ amount: 0, notes: '' });

  const [editedVendor, setEditedVendor] = useState<Partial<Vendor>>({});

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  async function fetchData() {
    const [vendorRes, itemsRes, purchasesRes, directIssuesRes] = await Promise.all([
      supabase.from('vendors').select('*').eq('id', id!).single(),
      supabase.from('items').select('*').eq('vendor_id', id!).order('name'),
      supabase.from('purchases').select('*').eq('vendor_id', id!).order('date', { ascending: false }),
      supabase.from('issues').select('*, purchases(description)').eq('vendor_id', id!).order('created_at', { ascending: false }),
    ]);

    if (vendorRes.error) {
      toast({ title: 'Error', description: 'Vendor not found', variant: 'destructive' });
      navigate('/vendors');
      return;
    }

    setVendor(vendorRes.data);
    setEditedVendor(vendorRes.data);
    setPurchases(purchasesRes.data || []);
    
    // Also get items from purchase allocations for this vendor
    const directItems = itemsRes.data || [];
    const directItemIds = new Set(directItems.map(i => i.id));
    
    // Fetch items linked through purchases
    const purchaseIds = (purchasesRes.data || []).map(p => p.id);
    let allItemIds = [...directItemIds];
    
    if (purchaseIds.length > 0) {
      const { data: allocations } = await supabase
        .from('purchase_allocations')
        .select('item_id')
        .in('purchase_id', purchaseIds)
        .not('item_id', 'is', null);
      
      const additionalItemIds = [...new Set((allocations || []).map(a => a.item_id).filter(Boolean))]
        .filter(itemId => !directItemIds.has(itemId));
      
      allItemIds = [...directItemIds, ...additionalItemIds];
      
      if (additionalItemIds.length > 0) {
        const { data: additionalItems } = await supabase
          .from('items')
          .select('*')
          .in('id', additionalItemIds);
        
        setItems([...directItems, ...(additionalItems || [])]);
      } else {
        setItems(directItems);
      }
    } else {
      setItems(directItems);
    }
    
    // Combine direct issues with issues linked through purchases and items
    let allIssues = directIssuesRes.data || [];
    const directIssueIds = new Set(allIssues.map(i => i.id));
    
    // Get issues linked to this vendor's purchases
    if (purchaseIds.length > 0) {
      const { data: purchaseIssues } = await supabase
        .from('issues')
        .select('*, purchases(description)')
        .in('purchase_id', purchaseIds)
        .order('created_at', { ascending: false });
      
      const newPurchaseIssues = (purchaseIssues || []).filter(i => !directIssueIds.has(i.id));
      allIssues = [...allIssues, ...newPurchaseIssues];
      newPurchaseIssues.forEach(i => directIssueIds.add(i.id));
    }
    
    // Get issues linked to this vendor's items
    if (allItemIds.length > 0) {
      const { data: itemIssueLinks } = await supabase
        .from('issue_items')
        .select('issue_id')
        .in('item_id', allItemIds);
      
      const linkedIssueIds = [...new Set((itemIssueLinks || []).map(l => l.issue_id))]
        .filter(issueId => !directIssueIds.has(issueId));
      
      if (linkedIssueIds.length > 0) {
        const { data: itemIssues } = await supabase
          .from('issues')
          .select('*, purchases(description)')
          .in('id', linkedIssueIds)
          .order('created_at', { ascending: false });
        
        allIssues = [...allIssues, ...(itemIssues || [])];
      }
    }
    
    setIssues(allIssues);
    setLoading(false);
  }

  async function handleSaveVendor() {
    if (!id) return;
    setSaving(true);

    const { error } = await supabase
      .from('vendors')
      .update({
        name: editedVendor.name,
        contact_name: editedVendor.contact_name,
        contact_email: editedVendor.contact_email,
        contact_phone: editedVendor.contact_phone,
        address: editedVendor.address,
        notes: editedVendor.notes,
        is_active: editedVendor.is_active,
        location_id: editedVendor.location_id,
      })
      .eq('id', id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Vendor updated' });
      setVendor({ ...vendor!, ...editedVendor });
      setEditMode(false);
    }
    setSaving(false);
  }

  async function handleAdjustCredit() {
    if (!id || creditAdjustment.amount === 0) {
      toast({ title: 'Error', description: 'Enter an amount', variant: 'destructive' });
      return;
    }

    const newBalance = (vendor?.credit_balance || 0) + creditAdjustment.amount;

    const { error } = await supabase
      .from('vendors')
      .update({ credit_balance: newBalance })
      .eq('id', id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Credit adjusted' });
      setCreditDialogOpen(false);
      setCreditAdjustment({ amount: 0, notes: '' });
      fetchData();
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-AU');
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (!vendor) {
    return <div className="p-4">Vendor not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/vendors')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{vendor.name}</h1>
          <p className="text-muted-foreground">Vendor Details</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <CreditCard className="h-4 w-4 mr-2" />
                Adjust Credit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adjust Vendor Credit</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Current Balance</p>
                  <p className="text-2xl font-bold">{formatCurrency(vendor.credit_balance || 0)}</p>
                </div>
                <div className="space-y-2">
                  <Label>Adjustment Amount (positive to add, negative to subtract)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={creditAdjustment.amount}
                    onChange={(e) => setCreditAdjustment({ ...creditAdjustment, amount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={creditAdjustment.notes}
                    onChange={(e) => setCreditAdjustment({ ...creditAdjustment, notes: e.target.value })}
                    placeholder="Reason for adjustment..."
                  />
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">New Balance</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency((vendor.credit_balance || 0) + creditAdjustment.amount)}
                  </p>
                </div>
                <Button className="w-full" onClick={handleAdjustCredit}>
                  Apply Adjustment
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          {editMode ? (
            <Button onClick={handleSaveVendor} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setEditMode(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credit Balance</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(vendor.credit_balance || 0) > 0 ? 'text-green-600' : ''}`}>
              {formatCurrency(vendor.credit_balance || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{items.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Purchases</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{purchases.length}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(purchases.reduce((sum, p) => sum + p.total, 0))} total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {issues.filter(i => i.status !== 'closed' && i.status !== 'resolved').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="items">Items ({items.length})</TabsTrigger>
          <TabsTrigger value="purchases">Purchases ({purchases.length})</TabsTrigger>
          <TabsTrigger value="issues">Issues ({issues.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vendor Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {editMode ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={editedVendor.name || ''}
                        onChange={(e) => setEditedVendor({ ...editedVendor, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Contact Name</Label>
                      <Input
                        value={editedVendor.contact_name || ''}
                        onChange={(e) => setEditedVendor({ ...editedVendor, contact_name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        value={editedVendor.contact_email || ''}
                        onChange={(e) => setEditedVendor({ ...editedVendor, contact_email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input
                        value={editedVendor.contact_phone || ''}
                        onChange={(e) => setEditedVendor({ ...editedVendor, contact_phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Textarea
                      value={editedVendor.address || ''}
                      onChange={(e) => setEditedVendor({ ...editedVendor, address: e.target.value })}
                    />
                  </div>
                  <LocationSelector
                    value={editedVendor.location_id || null}
                    onChange={(locationId) => setEditedVendor({ ...editedVendor, location_id: locationId })}
                  />
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={editedVendor.notes || ''}
                      onChange={(e) => setEditedVendor({ ...editedVendor, notes: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={editedVendor.is_active ?? true}
                      onCheckedChange={(checked) => setEditedVendor({ ...editedVendor, is_active: checked })}
                    />
                    <Label>Active</Label>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Contact Name</p>
                    <p>{vendor.contact_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p>{vendor.contact_email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p>{vendor.contact_phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant={vendor.is_active ? 'default' : 'secondary'}>
                      {vendor.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="whitespace-pre-wrap">{vendor.address || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Notes</p>
                    <p className="whitespace-pre-wrap">{vendor.notes || '-'}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4">
          <AffiliatedContacts entityType="vendor" entityId={id!} />
        </TabsContent>

        <TabsContent value="items" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Sales Price</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No items from this vendor
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Link to={`/inventory/${item.id}`} className="hover:underline">
                            {item.sku}
                          </Link>
                        </TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.category || '-'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unit_cost || 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.sales_price || 0)}</TableCell>
                        <TableCell className="text-right">{item.current_stock || 0}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="purchases" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No purchases from this vendor
                      </TableCell>
                    </TableRow>
                  ) : (
                    purchases.map((purchase) => (
                      <TableRow key={purchase.id}>
                        <TableCell>{formatDate(purchase.date)}</TableCell>
                        <TableCell>{purchase.description}</TableCell>
                        <TableCell>{purchase.reference || '-'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(purchase.amount)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(purchase.tax_amount || 0)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(purchase.total)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="issues" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => navigate(`/issues?vendor=${id}`)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Issue
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issues.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No issues for this vendor
                      </TableCell>
                    </TableRow>
                  ) : (
                    issues.map((issue) => (
                      <TableRow key={issue.id}>
                        <TableCell>
                          <Link to={`/issues/${issue.id}`} className="hover:underline">
                            {issue.title}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            issue.status === 'closed' || issue.status === 'resolved' ? 'secondary' :
                            issue.status === 'in_progress' ? 'default' : 'outline'
                          }>
                            {issue.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            issue.severity === 'critical' ? 'destructive' :
                            issue.severity === 'high' ? 'destructive' :
                            issue.severity === 'medium' ? 'default' : 'secondary'
                          }>
                            {issue.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(issue.created_at)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
