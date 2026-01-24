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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Trash2, MapPin, Building2, Users, HardDrive, Briefcase, Plus, X } from 'lucide-react';

interface LocationContact {
  id: string;
  name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  is_primary: boolean;
}

interface LinkedEntity {
  id: string;
  name: string;
  type: string;
}

const LOCATION_TYPES = [
  'Office',
  'Warehouse',
  'Site',
  'Branch',
  'Storage',
  'Retail',
  'Other',
];

export default function LocationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [contacts, setContacts] = useState<LocationContact[]>([]);
  const [linkedVendors, setLinkedVendors] = useState<LinkedEntity[]>([]);
  const [linkedClients, setLinkedClients] = useState<LinkedEntity[]>([]);
  const [linkedAssets, setLinkedAssets] = useState<LinkedEntity[]>([]);
  const [linkedJobs, setLinkedJobs] = useState<LinkedEntity[]>([]);

  const [newContact, setNewContact] = useState({ name: '', title: '', phone: '', email: '' });
  const [addingContact, setAddingContact] = useState(false);

  const [location, setLocation] = useState({
    name: '',
    location_type: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postcode: '',
    country: 'Australia',
    phone: '',
    email: '',
    notes: '',
    is_active: true,
  });

  useEffect(() => {
    if (!isNew && id) {
      fetchLocation();
      fetchContacts();
      fetchLinkedEntities();
    }
  }, [id, isNew]);

  async function fetchLocation() {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      toast({ title: 'Error', description: 'Location not found', variant: 'destructive' });
      navigate('/locations');
    } else {
      setLocation({
        name: data.name,
        location_type: data.location_type || '',
        address_line1: data.address_line1 || '',
        address_line2: data.address_line2 || '',
        city: data.city || '',
        state: data.state || '',
        postcode: data.postcode || '',
        country: data.country || 'Australia',
        phone: data.phone || '',
        email: data.email || '',
        notes: data.notes || '',
        is_active: data.is_active ?? true,
      });
    }
    setLoading(false);
  }

  async function fetchContacts() {
    const { data } = await supabase
      .from('location_contacts')
      .select('*')
      .eq('location_id', id)
      .order('is_primary', { ascending: false });

    setContacts(data || []);
  }

  async function fetchLinkedEntities() {
    const [vendors, clients, assets, jobs] = await Promise.all([
      supabase.from('vendors').select('id, name').eq('location_id', id),
      supabase.from('clients').select('id, name').eq('location_id', id),
      supabase.from('assets').select('id, name').eq('location_id', id),
      supabase.from('jobs').select('id, name').eq('location_id', id),
    ]);

    setLinkedVendors((vendors.data || []).map((v) => ({ ...v, type: 'vendor' })));
    setLinkedClients((clients.data || []).map((c) => ({ ...c, type: 'client' })));
    setLinkedAssets((assets.data || []).map((a) => ({ ...a, type: 'asset' })));
    setLinkedJobs((jobs.data || []).map((j) => ({ ...j, type: 'job' })));
  }

  async function handleSave() {
    if (!location.name.trim()) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' });
      return;
    }

    setSaving(true);

    const locationData = {
      name: location.name,
      location_type: location.location_type || null,
      address_line1: location.address_line1 || null,
      address_line2: location.address_line2 || null,
      city: location.city || null,
      state: location.state || null,
      postcode: location.postcode || null,
      country: location.country || null,
      phone: location.phone || null,
      email: location.email || null,
      notes: location.notes || null,
      is_active: location.is_active,
    };

    if (isNew) {
      const { data, error } = await supabase
        .from('locations')
        .insert(locationData)
        .select()
        .single();

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Location created' });
        navigate(`/locations/${data.id}`);
      }
    } else {
      const { error } = await supabase.from('locations').update(locationData).eq('id', id);

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Location saved' });
      }
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this location?')) return;

    const { error } = await supabase.from('locations').delete().eq('id', id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Location deleted' });
      navigate('/locations');
    }
  }

  async function handleAddContact() {
    if (!newContact.name.trim()) {
      toast({ title: 'Error', description: 'Contact name is required', variant: 'destructive' });
      return;
    }

    setAddingContact(true);

    const { error } = await supabase.from('location_contacts').insert({
      location_id: id,
      name: newContact.name,
      title: newContact.title || null,
      phone: newContact.phone || null,
      email: newContact.email || null,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setNewContact({ name: '', title: '', phone: '', email: '' });
      fetchContacts();
      toast({ title: 'Success', description: 'Contact added' });
    }
    setAddingContact(false);
  }

  async function handleDeleteContact(contactId: string) {
    const { error } = await supabase.from('location_contacts').delete().eq('id', contactId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      fetchContacts();
      toast({ title: 'Success', description: 'Contact removed' });
    }
  }

  async function handleSetPrimaryContact(contactId: string) {
    // Remove primary from all
    await supabase.from('location_contacts').update({ is_primary: false }).eq('location_id', id);
    // Set new primary
    await supabase.from('location_contacts').update({ is_primary: true }).eq('id', contactId);
    fetchContacts();
  }

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/locations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{isNew ? 'New Location' : location.name}</h1>
          {!isNew && (
            <div className="flex items-center gap-2 mt-1">
              {location.location_type && <Badge variant="outline">{location.location_type}</Badge>}
              <Badge variant={location.is_active ? 'default' : 'secondary'}>
                {location.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          )}
        </div>
        {!isNew && (
          <Button variant="outline" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        )}
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          {!isNew && <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>}
          {!isNew && (
            <TabsTrigger value="linked">
              Linked ({linkedVendors.length + linkedClients.length + linkedAssets.length + linkedJobs.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="details" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Location Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={location.name}
                    onChange={(e) => setLocation({ ...location, name: e.target.value })}
                    placeholder="Enter location name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={location.location_type || '__none__'}
                    onValueChange={(v) => setLocation({ ...location, location_type: v === '__none__' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {LOCATION_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Active</Label>
                  <Switch
                    checked={location.is_active}
                    onCheckedChange={(checked) => setLocation({ ...location, is_active: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={location.phone}
                    onChange={(e) => setLocation({ ...location, phone: e.target.value })}
                    placeholder="Phone number"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={location.email}
                    onChange={(e) => setLocation({ ...location, email: e.target.value })}
                    placeholder="Email address"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Address Line 1</Label>
                    <Input
                      value={location.address_line1}
                      onChange={(e) => setLocation({ ...location, address_line1: e.target.value })}
                      placeholder="Street address"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Address Line 2</Label>
                    <Input
                      value={location.address_line2}
                      onChange={(e) => setLocation({ ...location, address_line2: e.target.value })}
                      placeholder="Suite, unit, etc."
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      value={location.city}
                      onChange={(e) => setLocation({ ...location, city: e.target.value })}
                      placeholder="City"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>State</Label>
                    <Input
                      value={location.state}
                      onChange={(e) => setLocation({ ...location, state: e.target.value })}
                      placeholder="State"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Postcode</Label>
                    <Input
                      value={location.postcode}
                      onChange={(e) => setLocation({ ...location, postcode: e.target.value })}
                      placeholder="Postcode"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Input
                      value={location.country}
                      onChange={(e) => setLocation({ ...location, country: e.target.value })}
                      placeholder="Country"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={location.notes}
                  onChange={(e) => setLocation({ ...location, notes: e.target.value })}
                  placeholder="Additional notes about this location..."
                  rows={4}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {!isNew && (
          <TabsContent value="contacts" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Location Contacts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  <Input
                    placeholder="Name *"
                    value={newContact.name}
                    onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  />
                  <Input
                    placeholder="Title"
                    value={newContact.title}
                    onChange={(e) => setNewContact({ ...newContact, title: e.target.value })}
                  />
                  <Input
                    placeholder="Phone"
                    value={newContact.phone}
                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  />
                  <Input
                    placeholder="Email"
                    value={newContact.email}
                    onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  />
                  <Button onClick={handleAddContact} disabled={addingContact}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>

                {contacts.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Primary</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contacts.map((contact) => (
                        <TableRow key={contact.id}>
                          <TableCell className="font-medium">{contact.name}</TableCell>
                          <TableCell>{contact.title || '-'}</TableCell>
                          <TableCell>{contact.phone || '-'}</TableCell>
                          <TableCell>{contact.email || '-'}</TableCell>
                          <TableCell>
                            <Switch
                              checked={contact.is_primary}
                              onCheckedChange={() => handleSetPrimaryContact(contact.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteContact(contact.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {!isNew && (
          <TabsContent value="linked" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Clients ({linkedClients.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {linkedClients.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No clients at this location</p>
                  ) : (
                    <div className="space-y-2">
                      {linkedClients.map((client) => (
                        <Link
                          key={client.id}
                          to={`/clients/${client.id}`}
                          className="block p-2 border rounded hover:bg-muted/50"
                        >
                          {client.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Vendors ({linkedVendors.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {linkedVendors.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No vendors at this location</p>
                  ) : (
                    <div className="space-y-2">
                      {linkedVendors.map((vendor) => (
                        <Link
                          key={vendor.id}
                          to={`/vendors/${vendor.id}`}
                          className="block p-2 border rounded hover:bg-muted/50"
                        >
                          {vendor.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5" />
                    Assets ({linkedAssets.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {linkedAssets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No assets at this location</p>
                  ) : (
                    <div className="space-y-2">
                      {linkedAssets.map((asset) => (
                        <Link
                          key={asset.id}
                          to={`/assets/${asset.id}`}
                          className="block p-2 border rounded hover:bg-muted/50"
                        >
                          {asset.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Jobs ({linkedJobs.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {linkedJobs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No jobs at this location</p>
                  ) : (
                    <div className="space-y-2">
                      {linkedJobs.map((job) => (
                        <Link
                          key={job.id}
                          to={`/jobs/${job.id}`}
                          className="block p-2 border rounded hover:bg-muted/50"
                        >
                          {job.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
