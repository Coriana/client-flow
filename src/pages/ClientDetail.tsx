import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import ClientContacts from '@/components/ClientContacts';
import LocationSelector from '@/components/LocationSelector';
import type { Tables } from '@/integrations/supabase/types';

type Client = Tables<'clients'>;

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = id === 'new';
  
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [client, setClient] = useState<Partial<Client>>({
    name: '',
    trading_name: '',
    abn: '',
    acn: '',
    billing_address: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    payment_terms: 30,
    notes: '',
    is_active: true,
  });
  const [jobs, setJobs] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [primaryContact, setPrimaryContact] = useState<any>(null);

  useEffect(() => {
    if (!isNew && id) {
      fetchClient();
      fetchRelatedData();
      fetchPrimaryContact();
    }
  }, [id, isNew]);

  async function fetchPrimaryContact() {
    const { data } = await supabase
      .from('client_contacts')
      .select('*')
      .eq('client_id', id)
      .eq('is_primary', true)
      .eq('is_active', true)
      .single();
    
    setPrimaryContact(data);
  }

  async function fetchClient() {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      toast({ title: 'Error', description: 'Account not found', variant: 'destructive' });
      navigate('/clients');
    } else {
      setClient(data);
    }
    setLoading(false);
  }

  async function fetchRelatedData() {
    const [jobsRes, invoicesRes] = await Promise.all([
      supabase.from('jobs').select('*').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').eq('client_id', id).order('issue_date', { ascending: false }),
    ]);
    
    setJobs(jobsRes.data || []);
    setInvoices(invoicesRes.data || []);
  }

  async function handleSave() {
    setSaving(true);
    
    if (!client.name) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' });
      setSaving(false);
      return;
    }

    if (isNew) {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('clients')
        .insert({ ...client, user_id: userData.user?.id } as any)
        .select()
        .single();
      
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Account created' });
        navigate(`/clients/${data.id}`);
      }
    } else {
      const { error } = await supabase
        .from('clients')
        .update(client)
        .eq('id', id);
      
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Account updated' });
      }
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this account?')) return;
    
    const { error } = await supabase.from('clients').delete().eq('id', id);
    
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Account deleted' });
      navigate('/clients');
    }
  }

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/clients">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {isNew ? 'New Account' : client.name}
          </h1>
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

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          {!isNew && <TabsTrigger value="contacts">Contacts</TabsTrigger>}
          {!isNew && <TabsTrigger value="jobs">Jobs ({jobs.length})</TabsTrigger>}
          {!isNew && <TabsTrigger value="invoices">Invoices ({invoices.length})</TabsTrigger>}
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Company Name *</Label>
                  <Input
                    id="name"
                    value={client.name || ''}
                    onChange={(e) => setClient({ ...client, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trading_name">Trading Name</Label>
                  <Input
                    id="trading_name"
                    value={client.trading_name || ''}
                    onChange={(e) => setClient({ ...client, trading_name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="abn">ABN</Label>
                    <Input
                      id="abn"
                      value={client.abn || ''}
                      onChange={(e) => setClient({ ...client, abn: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="acn">ACN</Label>
                    <Input
                      id="acn"
                      value={client.acn || ''}
                      onChange={(e) => setClient({ ...client, acn: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billing_address">Billing Address</Label>
                  <Textarea
                    id="billing_address"
                    value={client.billing_address || ''}
                    onChange={(e) => setClient({ ...client, billing_address: e.target.value })}
                    rows={3}
                  />
                </div>
                <LocationSelector
                  value={client.location_id || null}
                  onChange={(locationId) => setClient({ ...client, location_id: locationId })}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Primary Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isNew && primaryContact ? (
                  <>
                    <div className="space-y-2">
                      <Label>Contact Name</Label>
                      <Input value={primaryContact.name || ''} readOnly className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input value={primaryContact.email || ''} readOnly className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input value={primaryContact.phone || ''} readOnly className="bg-muted" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Manage contacts in the Contacts tab
                    </p>
                  </>
                ) : !isNew ? (
                  <p className="text-muted-foreground">
                    No primary contact set. Add contacts in the Contacts tab.
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    Save the account first, then add contacts in the Contacts tab.
                  </p>
                )}
                <div className="border-t pt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="payment_terms">Payment Terms (days)</Label>
                    <Input
                      id="payment_terms"
                      type="number"
                      value={client.payment_terms || 30}
                      onChange={(e) => setClient({ ...client, payment_terms: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="is_active"
                      checked={client.is_active ?? true}
                      onCheckedChange={(checked) => setClient({ ...client, is_active: checked })}
                    />
                    <Label htmlFor="is_active">Active</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="default_billable_time"
                      checked={(client as any).default_billable_time ?? true}
                      onCheckedChange={(checked) => setClient({ ...client, default_billable_time: checked } as any)}
                    />
                    <Label htmlFor="default_billable_time">Time Entries Billable by Default</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="default_billable_expenses"
                      checked={(client as any).default_billable_expenses ?? false}
                      onCheckedChange={(checked) => setClient({ ...client, default_billable_expenses: checked } as any)}
                    />
                    <Label htmlFor="default_billable_expenses">Expenses Billable by Default</Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={client.notes || ''}
                  onChange={(e) => setClient({ ...client, notes: e.target.value })}
                  rows={4}
                  placeholder="Internal notes about this account..."
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {!isNew && (
          <TabsContent value="contacts">
            <ClientContacts clientId={id!} />
          </TabsContent>
        )}

        <TabsContent value="jobs">
          <Card>
            <CardContent className="pt-6">
              {jobs.length === 0 ? (
                <p className="text-muted-foreground">No jobs for this account yet</p>
              ) : (
                <div className="space-y-2">
                  {jobs.map((job) => (
                    <Link
                      key={job.id}
                      to={`/jobs/${job.id}`}
                      className="block p-3 rounded-lg hover:bg-muted"
                    >
                      <div className="font-medium">{job.name}</div>
                      <div className="text-sm text-muted-foreground">{job.job_number}</div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardContent className="pt-6">
              {invoices.length === 0 ? (
                <p className="text-muted-foreground">No invoices for this account yet</p>
              ) : (
                <div className="space-y-2">
                  {invoices.map((inv) => (
                    <Link
                      key={inv.id}
                      to={`/invoices/${inv.id}`}
                      className="block p-3 rounded-lg hover:bg-muted"
                    >
                      <div className="font-medium">{inv.invoice_number}</div>
                      <div className="text-sm text-muted-foreground">
                        ${inv.total.toFixed(2)} - {inv.status}
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
