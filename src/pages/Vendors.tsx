import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Plus, Search, Store, CreditCard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PermissionGate } from '@/components/PermissionGate';
import { EmptyState } from '@/components/EmptyState';
import { useBranding } from '@/contexts/BrandingContext';
import type { Tables } from '@/integrations/supabase/types';

type Vendor = Tables<'vendors'>;

export default function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { formatCurrency } = useBranding();

  const [newVendor, setNewVendor] = useState({
    name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    notes: '',
  });

  useEffect(() => {
    fetchVendors();
  }, []);

  async function fetchVendors() {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching vendors:', error);
    } else {
      setVendors(data || []);
    }
    setLoading(false);
  }

  async function handleAddVendor() {
    if (!newVendor.name.trim()) {
      toast({ title: 'Error', description: 'Vendor name is required', variant: 'destructive' });
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('vendors').insert({
      name: newVendor.name.trim(),
      contact_name: newVendor.contact_name.trim() || null,
      contact_email: newVendor.contact_email.trim() || null,
      contact_phone: newVendor.contact_phone.trim() || null,
      address: newVendor.address.trim() || null,
      notes: newVendor.notes.trim() || null,
      user_id: userData.user?.id,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Vendor added' });
      setDialogOpen(false);
      setNewVendor({
        name: '',
        contact_name: '',
        contact_email: '',
        contact_phone: '',
        address: '',
        notes: '',
      });
      fetchVendors();
    }
  }

  const filteredVendors = vendors.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
    v.contact_email?.toLowerCase().includes(search.toLowerCase())
  );

  const totalCredit = vendors.reduce((sum, v) => sum + (v.credit_balance || 0), 0);

  if (loading) {
    return <div className="p-4">Loading vendors...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vendors</h1>
          <p className="text-muted-foreground">Manage your suppliers and vendors</p>
        </div>
        <PermissionGate resource="vendors" action="write">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
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
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={newVendor.notes}
                    onChange={(e) => setNewVendor({ ...newVendor, notes: e.target.value })}
                  />
                </div>
                <Button className="w-full" onClick={handleAddVendor}>
                  Add Vendor
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </PermissionGate>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vendors</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vendors.length}</div>
            <p className="text-xs text-muted-foreground">
              {vendors.filter(v => v.is_active).length} active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Credit Available</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalCredit)}</div>
            <p className="text-xs text-muted-foreground">
              Across all vendors
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search vendors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {vendors.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No vendors yet"
          description="Add a vendor to track suppliers, purchases, and credit."
          action={
            <PermissionGate resource="vendors" action="write">
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Vendor
              </Button>
            </PermissionGate>
          }
        />
      ) : (
        <>
          {/* table (desktop) */}
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Credit</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVendors.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <p className="text-muted-foreground">No matches for "{search}"</p>
                          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSearch('')}>
                            Clear search
                          </Button>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredVendors.map((vendor) => (
                        <TableRow
                          key={vendor.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/vendors/${vendor.id}`)}
                        >
                          <TableCell className="font-medium">{vendor.name}</TableCell>
                          <TableCell>{vendor.contact_name || '-'}</TableCell>
                          <TableCell>{vendor.contact_email || '-'}</TableCell>
                          <TableCell>{vendor.contact_phone || '-'}</TableCell>
                          <TableCell>
                            {(vendor.credit_balance || 0) > 0 ? (
                              <span className="text-green-600 font-medium">
                                {formatCurrency(vendor.credit_balance || 0)}
                              </span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={vendor.is_active ? 'default' : 'secondary'}>
                              {vendor.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* cards (mobile) */}
          <div className="space-y-3 md:hidden">
            {filteredVendors.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No matches for "{search}"</p>
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSearch('')}>
                  Clear search
                </Button>
              </div>
            ) : (
              filteredVendors.map((vendor) => (
                <Link
                  key={vendor.id}
                  to={`/vendors/${vendor.id}`}
                  className="block rounded-lg border bg-card p-4 transition-colors active:bg-muted"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{vendor.name}</span>
                    <Badge variant={vendor.is_active ? 'default' : 'secondary'}>
                      {vendor.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  {(vendor.contact_name || vendor.contact_email) && (
                    <div className="mt-2 space-y-0.5 text-sm text-muted-foreground">
                      {vendor.contact_name && <p>{vendor.contact_name}</p>}
                      {vendor.contact_email && <p>{vendor.contact_email}</p>}
                    </div>
                  )}
                </Link>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
