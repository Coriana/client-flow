import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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
  DialogFooter,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useConfirm } from '@/components/ConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { formatDisplayDate, todayLocal } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { ArrowLeft, Save, Plus, Check, ChevronsUpDown } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Affiliation = Tables<'contact_affiliations'>;

type AffiliationWithOrg = Affiliation & {
  clients: { name: string } | null;
  vendors: { name: string } | null;
};

interface OrgOption {
  id: string;
  name: string;
}

const emptyContact = {
  name: '',
  email: '',
  phone: '',
  notes: '',
  is_active: true,
};

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const confirm = useConfirm();
  const isNew = id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [contact, setContact] = useState(emptyContact);

  const [affiliations, setAffiliations] = useState<AffiliationWithOrg[]>([]);
  const [affiliationsLoading, setAffiliationsLoading] = useState(false);

  // Add Affiliation dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [orgType, setOrgType] = useState<'client' | 'vendor'>('client');
  const [clients, setClients] = useState<OrgOption[]>([]);
  const [vendors, setVendors] = useState<OrgOption[]>([]);
  const [orgId, setOrgId] = useState('');
  const [orgPickerOpen, setOrgPickerOpen] = useState(false);
  const [affTitle, setAffTitle] = useState('');
  const [affStartDate, setAffStartDate] = useState(todayLocal());
  const [affIsPrimary, setAffIsPrimary] = useState(false);
  const [addingAffiliation, setAddingAffiliation] = useState(false);

  useEffect(() => {
    if (!isNew && id) {
      fetchContact();
      fetchAffiliations();
    }
  }, [id, isNew]);

  useEffect(() => {
    if (dialogOpen) {
      fetchOrgs();
    }
  }, [dialogOpen]);

  async function fetchContact() {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      toast({ title: 'Error', description: 'Contact not found', variant: 'destructive' });
      navigate('/contacts');
      return;
    }

    setContact({
      name: data.name,
      email: data.email || '',
      phone: data.phone || '',
      notes: data.notes || '',
      is_active: data.is_active ?? true,
    });
    setLoading(false);
  }

  async function fetchAffiliations() {
    setAffiliationsLoading(true);
    const { data, error } = await supabase
      .from('contact_affiliations')
      .select('*, clients(name), vendors(name)')
      .eq('contact_id', id);

    if (error) {
      console.error('Error fetching affiliations:', error);
    }

    // Current (no end date) first, newest start_date first within each group.
    const sorted = [...((data || []) as AffiliationWithOrg[])].sort((a, b) => {
      const aCurrent = a.end_date == null;
      const bCurrent = b.end_date == null;
      if (aCurrent !== bCurrent) return aCurrent ? -1 : 1;
      return (b.start_date || '').localeCompare(a.start_date || '');
    });

    setAffiliations(sorted);
    setAffiliationsLoading(false);
  }

  async function fetchOrgs() {
    const [clientsRes, vendorsRes] = await Promise.all([
      supabase.from('clients').select('id, name').eq('is_active', true).order('name'),
      supabase.from('vendors').select('id, name').eq('is_active', true).order('name'),
    ]);
    setClients(clientsRes.data || []);
    setVendors(vendorsRes.data || []);
  }

  async function handleSave() {
    if (!contact.name.trim()) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' });
      return;
    }

    setSaving(true);

    const payload = {
      name: contact.name.trim(),
      email: contact.email || null,
      phone: contact.phone || null,
      notes: contact.notes || null,
      is_active: contact.is_active,
    };

    if (isNew) {
      const { data, error } = await supabase
        .from('contacts')
        .insert(payload)
        .select()
        .single();

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Contact created' });
        navigate(`/contacts/${data.id}`);
      }
    } else {
      const { error } = await supabase.from('contacts').update(payload).eq('id', id);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Contact saved' });
      }
    }
    setSaving(false);
  }

  function openAddAffiliationDialog() {
    setOrgType('client');
    setOrgId('');
    setAffTitle('');
    setAffStartDate(todayLocal());
    setAffIsPrimary(false);
    setDialogOpen(true);
  }

  async function handleAddAffiliation() {
    if (!orgId) {
      toast({ title: 'Error', description: `Select a ${orgType}`, variant: 'destructive' });
      return;
    }

    setAddingAffiliation(true);

    if (orgType === 'client' && affIsPrimary) {
      // Clear primary on this client's other current affiliations first.
      await supabase
        .from('contact_affiliations')
        .update({ is_primary: false })
        .eq('client_id', orgId)
        .is('end_date', null);
    }

    const { error } = await supabase.from('contact_affiliations').insert({
      contact_id: id,
      client_id: orgType === 'client' ? orgId : null,
      vendor_id: orgType === 'vendor' ? orgId : null,
      title: affTitle || null,
      start_date: affStartDate || todayLocal(),
      is_primary: orgType === 'client' ? affIsPrimary : false,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Affiliation added' });
      setDialogOpen(false);
      fetchAffiliations();
    }
    setAddingAffiliation(false);
  }

  async function handleEndAffiliation(affiliation: AffiliationWithOrg) {
    const orgName = affiliation.clients?.name || affiliation.vendors?.name || 'this organisation';
    if (!(await confirm({
      title: 'End this affiliation?',
      description: `End ${contact.name || 'this contact'}'s affiliation with ${orgName}?`,
      confirmLabel: 'End Affiliation',
    }))) return;

    const { error } = await supabase
      .from('contact_affiliations')
      .update({ end_date: todayLocal() })
      .eq('id', affiliation.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Affiliation ended' });
      fetchAffiliations();
    }
  }

  async function handleSetPrimary(affiliation: AffiliationWithOrg) {
    if (!affiliation.client_id) return;

    await supabase
      .from('contact_affiliations')
      .update({ is_primary: false })
      .eq('client_id', affiliation.client_id)
      .is('end_date', null);

    const { error } = await supabase
      .from('contact_affiliations')
      .update({ is_primary: true })
      .eq('id', affiliation.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Primary contact updated' });
      fetchAffiliations();
    }
  }

  if (loading) return <div className="p-8">Loading...</div>;

  const orgOptions = orgType === 'client' ? clients : vendors;
  const selectedOrg = orgOptions.find((o) => o.id === orgId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/contacts">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{isNew ? 'New Contact' : contact.name}</h1>
          {!isNew && (
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={contact.is_active ? 'default' : 'secondary'}>
                {contact.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          )}
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={contact.name}
                onChange={(e) => setContact({ ...contact, name: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={contact.email}
                onChange={(e) => setContact({ ...contact, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={contact.phone}
                onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                placeholder="Phone number"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={contact.is_active}
                onCheckedChange={(checked) => setContact({ ...contact, is_active: checked })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={contact.notes}
              onChange={(e) => setContact({ ...contact, notes: e.target.value })}
              placeholder="Additional notes about this contact..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {!isNew && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Affiliations</CardTitle>
            <Button size="sm" onClick={openAddAffiliationDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Affiliation
            </Button>
          </CardHeader>
          <CardContent>
            {affiliationsLoading ? (
              <p className="text-muted-foreground text-center py-4">Loading...</p>
            ) : affiliations.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No affiliations yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {affiliations.map((affiliation) => {
                    const isCurrent = affiliation.end_date == null;
                    const org = affiliation.client_id
                      ? { name: affiliation.clients?.name || 'Unknown client', href: `/clients/${affiliation.client_id}` }
                      : { name: affiliation.vendors?.name || 'Unknown vendor', href: `/vendors/${affiliation.vendor_id}` };

                    return (
                      <TableRow key={affiliation.id} className={cn(!isCurrent && 'text-muted-foreground')}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Link to={org.href} className="font-medium hover:underline">
                              {org.name}
                            </Link>
                            {!!affiliation.is_primary && !!affiliation.client_id && (
                              <Badge variant="secondary">Primary</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{affiliation.title || '-'}</TableCell>
                        <TableCell>
                          {formatDisplayDate(affiliation.start_date)} → {isCurrent ? 'Current' : formatDisplayDate(affiliation.end_date)}
                        </TableCell>
                        <TableCell className="text-right">
                          {isCurrent && (
                            <div className="flex justify-end gap-2">
                              {affiliation.client_id && !affiliation.is_primary && (
                                <Button variant="ghost" size="sm" onClick={() => handleSetPrimary(affiliation)}>
                                  Set Primary
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => handleEndAffiliation(affiliation)}>
                                End Affiliation
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Affiliation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Organisation type</Label>
              <ToggleGroup
                type="single"
                value={orgType}
                onValueChange={(v) => {
                  if (!v) return;
                  setOrgType(v as 'client' | 'vendor');
                  setOrgId('');
                  if (v !== 'client') setAffIsPrimary(false);
                }}
                className="justify-start"
              >
                <ToggleGroupItem value="client" className="px-4">Client</ToggleGroupItem>
                <ToggleGroupItem value="vendor" className="px-4">Vendor</ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="space-y-2">
              <Label>{orgType === 'client' ? 'Client' : 'Vendor'} *</Label>
              <Popover open={orgPickerOpen} onOpenChange={setOrgPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={orgPickerOpen}
                    className="w-full justify-between font-normal"
                  >
                    {selectedOrg ? selectedOrg.name : `Select ${orgType}...`}
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder={`Search ${orgType}s...`} />
                    <CommandList>
                      <CommandEmpty>No {orgType} found.</CommandEmpty>
                      <CommandGroup>
                        {orgOptions.map((org) => (
                          <CommandItem
                            key={org.id}
                            value={org.name}
                            onSelect={() => {
                              setOrgId(org.id);
                              setOrgPickerOpen(false);
                            }}
                          >
                            <Check className={cn('mr-2 h-4 w-4', orgId === org.id ? 'opacity-100' : 'opacity-0')} />
                            {org.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={affTitle}
                onChange={(e) => setAffTitle(e.target.value)}
                placeholder="e.g. Operations Manager"
              />
            </div>

            <div className="space-y-2">
              <Label>Start date</Label>
              <Input
                type="date"
                value={affStartDate}
                onChange={(e) => setAffStartDate(e.target.value)}
              />
            </div>

            {orgType === 'client' && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="affIsPrimary"
                  checked={affIsPrimary}
                  onCheckedChange={(checked) => setAffIsPrimary(checked === true)}
                />
                <Label htmlFor="affIsPrimary" className="font-normal cursor-pointer">
                  Primary contact
                </Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddAffiliation} disabled={addingAffiliation}>
              {addingAffiliation ? 'Adding...' : 'Add Affiliation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
