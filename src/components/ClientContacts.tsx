import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useConfirm } from '@/components/ConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Trash2, Star, Pencil, X, Check, User, History } from 'lucide-react';

interface Contact {
  id: string;
  client_id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

interface ContactHistoryEvent {
  id: string;
  event_type: string;
  description: string;
  created_at: string;
  old_values: any;
  new_values: any;
}

interface ClientContactsProps {
  clientId: string;
}

export default function ClientContacts({ clientId }: ClientContactsProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const confirm = useConfirm();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [history, setHistory] = useState<ContactHistoryEvent[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newContact, setNewContact] = useState({
    name: '',
    title: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    fetchContacts();
    fetchHistory();
  }, [clientId]);

  async function fetchContacts() {
    setLoading(true);
    const { data } = await supabase
      .from('client_contacts')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('is_primary', { ascending: false })
      .order('name');
    setContacts(data || []);
    setLoading(false);
  }

  async function fetchHistory() {
    const { data } = await supabase
      .from('client_contact_history')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(50);
    setHistory(data || []);
  }

  async function handleAddContact() {
    if (!newContact.name.trim()) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' });
      return;
    }

    const isFirst = contacts.length === 0;
    const { data, error } = await supabase.from('client_contacts').insert({
      client_id: clientId,
      name: newContact.name.trim(),
      title: newContact.title || null,
      email: newContact.email || null,
      phone: newContact.phone || null,
      is_primary: isFirst,
    }).select().single();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      // Log history
      await supabase.from('client_contact_history').insert({
        client_id: clientId,
        contact_id: data.id,
        event_type: 'created',
        description: `Contact "${newContact.name}" added`,
        new_values: data as any,
        created_by: user?.id,
      } as any);

      toast({ title: 'Success', description: 'Contact added' });
      setNewContact({ name: '', title: '', email: '', phone: '' });
      setShowAddForm(false);
      fetchContacts();
      fetchHistory();
    }
  }

  async function handleSetPrimary(contactId: string) {
    // Unset current primary
    await supabase.from('client_contacts').update({ is_primary: false }).eq('client_id', clientId).eq('is_primary', true);
    // Set new primary
    const { error } = await supabase.from('client_contacts').update({ is_primary: true }).eq('id', contactId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      const contact = contacts.find(c => c.id === contactId);
      await supabase.from('client_contact_history').insert({
        client_id: clientId,
        contact_id: contactId,
        event_type: 'set_primary',
        description: `"${contact?.name}" set as primary contact`,
        created_by: user?.id,
      } as any);

      toast({ title: 'Success', description: 'Primary contact updated' });
      fetchContacts();
      fetchHistory();
    }
  }

  async function handleDeleteContact(contact: Contact) {
    if (!(await confirm({
      title: 'Remove this contact?',
      description: `Remove ${contact.name} from contacts?`,
      confirmLabel: 'Remove',
      destructive: true,
    }))) return;

    const { error } = await supabase.from('client_contacts').update({ is_active: false }).eq('id', contact.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      await supabase.from('client_contact_history').insert({
        client_id: clientId,
        contact_id: contact.id,
        event_type: 'deleted',
        description: `Contact "${contact.name}" removed`,
        old_values: contact as any,
        created_by: user?.id,
      } as any);

      toast({ title: 'Success', description: 'Contact removed' });
      fetchContacts();
      fetchHistory();
    }
  }

  async function handleUpdateContact(contact: Contact) {
    const { error } = await supabase.from('client_contacts').update({
      name: contact.name,
      title: contact.title,
      email: contact.email,
      phone: contact.phone,
    }).eq('id', contact.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      await supabase.from('client_contact_history').insert({
        client_id: clientId,
        contact_id: contact.id,
        event_type: 'updated',
        description: `Contact "${contact.name}" updated`,
        new_values: contact as any,
        created_by: user?.id,
      } as any);

      toast({ title: 'Success', description: 'Contact updated' });
      setEditingId(null);
      fetchContacts();
      fetchHistory();
    }
  }

  if (loading) {
    return <div className="text-muted-foreground">Loading contacts...</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Contacts ({contacts.length})
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>
              <History className="h-4 w-4 mr-2" />
              {showHistory ? 'Hide History' : 'Show History'}
            </Button>
            <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showAddForm && (
            <div className="mb-4 p-4 border rounded-lg bg-muted/50 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Name *</Label>
                  <Input
                    value={newContact.name}
                    onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                    placeholder="Full name"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Title</Label>
                  <Input
                    value={newContact.title}
                    onChange={(e) => setNewContact({ ...newContact, title: e.target.value })}
                    placeholder="Job title"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={newContact.email}
                    onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input
                    value={newContact.phone}
                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                    placeholder="Phone number"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddContact}>
                  <Check className="h-4 w-4 mr-2" />
                  Save
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {contacts.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No contacts added yet</p>
          ) : (
            <div className="space-y-2">
              {contacts.map(contact => (
                <div key={contact.id} className="flex items-center justify-between p-3 border rounded-lg">
                  {editingId === contact.id ? (
                    <div className="flex-1 grid grid-cols-4 gap-2 mr-2">
                      <Input
                        value={contact.name}
                        onChange={(e) => setContacts(contacts.map(c => c.id === contact.id ? { ...c, name: e.target.value } : c))}
                        placeholder="Name"
                      />
                      <Input
                        value={contact.title || ''}
                        onChange={(e) => setContacts(contacts.map(c => c.id === contact.id ? { ...c, title: e.target.value } : c))}
                        placeholder="Title"
                      />
                      <Input
                        value={contact.email || ''}
                        onChange={(e) => setContacts(contacts.map(c => c.id === contact.id ? { ...c, email: e.target.value } : c))}
                        placeholder="Email"
                      />
                      <Input
                        value={contact.phone || ''}
                        onChange={(e) => setContacts(contacts.map(c => c.id === contact.id ? { ...c, phone: e.target.value } : c))}
                        placeholder="Phone"
                      />
                    </div>
                  ) : (
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{contact.name}</span>
                        {contact.title && <span className="text-muted-foreground">· {contact.title}</span>}
                        {contact.is_primary && (
                          <Badge variant="secondary" className="gap-1">
                            <Star className="h-3 w-3" />
                            Primary
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {contact.email && <span className="mr-4">{contact.email}</span>}
                        {contact.phone && <span>{contact.phone}</span>}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    {editingId === contact.id ? (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => handleUpdateContact(contact)}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setEditingId(null); fetchContacts(); }}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        {!contact.is_primary && (
                          <Button variant="ghost" size="sm" onClick={() => handleSetPrimary(contact.id)}>
                            <Star className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(contact.id)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteContact(contact)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showHistory && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Contact History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No history yet</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {history.map(event => (
                  <div key={event.id} className="flex items-center gap-3 p-2 border rounded-lg text-sm">
                    <Badge variant="outline" className="shrink-0">{event.event_type}</Badge>
                    <span className="flex-1">{event.description}</span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(event.created_at).toLocaleDateString('en-AU')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}