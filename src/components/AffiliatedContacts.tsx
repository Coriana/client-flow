import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search, Star, UserMinus, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useConfirm } from '@/components/ConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { todayLocal } from '@/lib/dates';
import { cn } from '@/lib/utils';

type Contact = Tables<'contacts'>;
type ContactAffiliation = Tables<'contact_affiliations'> & { contacts: Contact | null };

type AffiliatedContactsProps =
  | { entityType: 'client'; entityId: string }
  | { entityType: 'vendor'; entityId: string };

const emptyNewPerson = { name: '', title: '', email: '', phone: '' };

/**
 * Generalized "who's affiliated with this client/vendor" panel, built on the
 * person-centric `contacts` + `contact_affiliations` model. Replaces the old
 * per-client `ClientContacts` component.
 */
export default function AffiliatedContacts({ entityType, entityId }: AffiliatedContactsProps) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const entityColumn = entityType === 'client' ? 'client_id' : 'vendor_id';
  const affiliationsKey = ['affiliated-contacts', entityType, entityId];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<'new' | 'link'>('new');
  const [saving, setSaving] = useState(false);

  const [newPerson, setNewPerson] = useState(emptyNewPerson);
  const [newPersonPrimary, setNewPersonPrimary] = useState(false);
  const [newPersonStartDate, setNewPersonStartDate] = useState(todayLocal());
  const [newPersonEndDate, setNewPersonEndDate] = useState('');

  const [linkSearch, setLinkSearch] = useState('');
  const [linkSelectedId, setLinkSelectedId] = useState<string | null>(null);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkPrimary, setLinkPrimary] = useState(false);
  const [linkStartDate, setLinkStartDate] = useState(todayLocal());
  const [linkEndDate, setLinkEndDate] = useState('');

  const { data: affiliations = [], isLoading } = useQuery({
    queryKey: affiliationsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_affiliations')
        .select('*, contacts(*)')
        .eq(entityColumn, entityId)
        .is('end_date', null)
        .order('is_primary', { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []) as ContactAffiliation[];
    },
  });

  const currentContactIds = new Set(affiliations.map(a => a.contact_id));

  const { data: searchableContacts = [] } = useQuery({
    queryKey: ['contacts-searchable'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw new Error(error.message);
      return (data || []) as Contact[];
    },
    enabled: dialogOpen && mode === 'link',
  });

  const linkCandidates = searchableContacts.filter(c => {
    if (currentContactIds.has(c.id)) return false;
    const q = linkSearch.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q);
  });

  const sortedAffiliations = [...affiliations].sort((a, b) => {
    if (!!a.is_primary !== !!b.is_primary) {
      return a.is_primary ? -1 : 1;
    }
    return (a.contacts?.name ?? '').localeCompare(b.contacts?.name ?? '');
  });

  function resetDialog() {
    setMode('new');
    setNewPerson(emptyNewPerson);
    setNewPersonPrimary(false);
    setNewPersonStartDate(todayLocal());
    setNewPersonEndDate('');
    setLinkSearch('');
    setLinkSelectedId(null);
    setLinkTitle('');
    setLinkPrimary(false);
    setLinkStartDate(todayLocal());
    setLinkEndDate('');
  }

  function invalidateAffiliations() {
    queryClient.invalidateQueries({ queryKey: affiliationsKey });
  }

  /** Clear `is_primary` on every current affiliation for this client or vendor. */
  async function clearCurrentPrimary() {
    await supabase
      .from('contact_affiliations')
      .update({ is_primary: false })
      .eq(entityColumn, entityId)
      .eq('is_primary', true)
      .is('end_date', null);
  }

  async function handleCreateNewPerson() {
    if (!newPerson.name.trim()) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' });
      return;
    }

    if (newPersonEndDate && newPersonStartDate && newPersonEndDate < newPersonStartDate) {
      toast({ title: 'Error', description: 'End date cannot be before start date', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .insert({
        name: newPerson.name.trim(),
        email: newPerson.email.trim() || null,
        phone: newPerson.phone.trim() || null,
      })
      .select()
      .single();

    if (contactError || !contact) {
      toast({ title: 'Error', description: contactError?.message ?? 'Failed to create contact', variant: 'destructive' });
      setSaving(false);
      return;
    }

    if (newPersonPrimary) {
      await clearCurrentPrimary();
    }

    const { error: affiliationError } = await supabase.from('contact_affiliations').insert({
      contact_id: contact.id,
      [entityColumn]: entityId,
      title: newPerson.title.trim() || null,
      is_primary: newPersonPrimary,
      start_date: newPersonStartDate || todayLocal(),
      end_date: newPersonEndDate || null,
    });

    setSaving(false);
    if (affiliationError) {
      toast({ title: 'Error', description: affiliationError.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Success', description: 'Contact added' });
    setDialogOpen(false);
    resetDialog();
    invalidateAffiliations();
  }

  async function handleLinkExisting() {
    if (!linkSelectedId) {
      toast({ title: 'Error', description: 'Select a person to link', variant: 'destructive' });
      return;
    }

    if (linkEndDate && linkStartDate && linkEndDate < linkStartDate) {
      toast({ title: 'Error', description: 'End date cannot be before start date', variant: 'destructive' });
      return;
    }

    setSaving(true);

    if (linkPrimary) {
      await clearCurrentPrimary();
    }

    const { error } = await supabase.from('contact_affiliations').insert({
      contact_id: linkSelectedId,
      [entityColumn]: entityId,
      title: linkTitle.trim() || null,
      is_primary: linkPrimary,
      start_date: linkStartDate || todayLocal(),
      end_date: linkEndDate || null,
    });

    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Success', description: 'Contact linked' });
    setDialogOpen(false);
    resetDialog();
    invalidateAffiliations();
  }

  async function handleSetPrimary(affiliation: ContactAffiliation) {
    await clearCurrentPrimary();
    const { error } = await supabase
      .from('contact_affiliations')
      .update({ is_primary: true })
      .eq('id', affiliation.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Primary contact updated' });
      invalidateAffiliations();
    }
  }

  async function handleEndAffiliation(affiliation: ContactAffiliation) {
    const personName = affiliation.contacts?.name ?? 'This person';
    if (!(await confirm({
      title: 'End this affiliation?',
      description: `${personName} stays in Contacts with their full history — they'll just no longer show as current here.`,
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
      invalidateAffiliations();
    }
  }

  if (isLoading) {
    return <div className="text-muted-foreground">Loading contacts...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Contacts ({affiliations.length})
        </CardTitle>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetDialog();
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Contact</DialogTitle>
            </DialogHeader>
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'new' | 'link')}>
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="new">New Person</TabsTrigger>
                <TabsTrigger value="link">Link Existing</TabsTrigger>
              </TabsList>

              <TabsContent value="new" className="space-y-3 mt-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={newPerson.name}
                    onChange={(e) => setNewPerson({ ...newPerson, name: e.target.value })}
                    placeholder="Full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={newPerson.title}
                    onChange={(e) => setNewPerson({ ...newPerson, title: e.target.value })}
                    placeholder="Job title"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={newPerson.email}
                      onChange={(e) => setNewPerson({ ...newPerson, email: e.target.value })}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={newPerson.phone}
                      onChange={(e) => setNewPerson({ ...newPerson, phone: e.target.value })}
                      placeholder="Phone number"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Start date</Label>
                    <Input
                      type="date"
                      value={newPersonStartDate}
                      onChange={(e) => setNewPersonStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End date</Label>
                    <Input
                      type="date"
                      value={newPersonEndDate}
                      onChange={(e) => setNewPersonEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="new-person-primary"
                    checked={newPersonPrimary}
                    onCheckedChange={(checked) => setNewPersonPrimary(!!checked)}
                  />
                  <Label htmlFor="new-person-primary">Set as primary contact</Label>
                </div>
                <Button className="w-full" onClick={handleCreateNewPerson} disabled={saving}>
                  {saving ? 'Adding...' : 'Add Contact'}
                </Button>
              </TabsContent>

              <TabsContent value="link" className="space-y-3 mt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search by name or email..."
                    value={linkSearch}
                    onChange={(e) => setLinkSearch(e.target.value)}
                  />
                </div>
                <ScrollArea className="h-48 border rounded-md">
                  <div className="p-1">
                    {linkCandidates.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No matching people found
                      </p>
                    ) : (
                      linkCandidates.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setLinkSelectedId(c.id)}
                          className={cn(
                            'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                            linkSelectedId === c.id
                              ? 'bg-primary text-primary-foreground'
                              : 'hover:bg-muted'
                          )}
                        >
                          <div className="font-medium">{c.name}</div>
                          {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    placeholder="Job title at this entity"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Start date</Label>
                    <Input
                      type="date"
                      value={linkStartDate}
                      onChange={(e) => setLinkStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End date</Label>
                    <Input
                      type="date"
                      value={linkEndDate}
                      onChange={(e) => setLinkEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="link-primary"
                    checked={linkPrimary}
                    onCheckedChange={(checked) => setLinkPrimary(!!checked)}
                  />
                  <Label htmlFor="link-primary">Set as primary contact</Label>
                </div>
                <Button className="w-full" onClick={handleLinkExisting} disabled={saving || !linkSelectedId}>
                  {saving ? 'Linking...' : 'Link Contact'}
                </Button>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {sortedAffiliations.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No contacts yet</p>
        ) : (
          <div className="space-y-2">
            {sortedAffiliations.map(affiliation => {
              const contact = affiliation.contacts;
              return (
                <div key={affiliation.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Link to={`/contacts/${affiliation.contact_id}`} className="font-medium hover:underline">
                        {contact?.name ?? 'Unknown'}
                      </Link>
                      {affiliation.title && (
                        <span className="text-muted-foreground">· {affiliation.title}</span>
                      )}
                      {!!affiliation.is_primary && (
                        <Badge variant="secondary" className="gap-1">
                          <Star className="h-3 w-3" />
                          Primary
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {contact?.email && <span className="mr-4">{contact.email}</span>}
                      {contact?.phone && <span>{contact.phone}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!affiliation.is_primary && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetPrimary(affiliation)}
                        title="Set as primary contact"
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEndAffiliation(affiliation)}
                      title="End affiliation"
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
