import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, User } from 'lucide-react';
import { PermissionGate } from '@/components/PermissionGate';
import { EmptyState } from '@/components/EmptyState';
import type { Tables } from '@/integrations/supabase/types';

type Contact = Tables<'contacts'>;
type Affiliation = Tables<'contact_affiliations'>;

type AffiliationWithOrg = Affiliation & {
  clients: { name: string } | null;
  vendors: { name: string } | null;
};

type ContactWithAffiliations = Contact & {
  contact_affiliations: AffiliationWithOrg[] | null;
};

async function fetchContacts(): Promise<ContactWithAffiliations[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*, contact_affiliations(*, clients(name), vendors(name))')
    .order('name');

  if (error) {
    console.error('Error fetching contacts:', error);
    return [];
  }

  return (data || []) as ContactWithAffiliations[];
}

/** Affiliations still in effect (no end date). */
function currentAffiliations(contact: ContactWithAffiliations): AffiliationWithOrg[] {
  return (contact.contact_affiliations || []).filter((a) => a.end_date == null);
}

/** e.g. "Acme Widgets Pty Ltd — Operations Manager, Beta Co — Consultant" */
function organisationLabel(contact: ContactWithAffiliations): string {
  return currentAffiliations(contact)
    .map((a) => {
      const orgName = a.clients?.name || a.vendors?.name || 'Unknown';
      return a.title ? `${orgName} — ${a.title}` : orgName;
    })
    .join(', ');
}

export default function Contacts() {
  const [search, setSearch] = useState('');
  const { data: contacts = [], isLoading: loading } = useQuery({
    queryKey: ['contacts'],
    queryFn: fetchContacts,
  });

  const query = search.toLowerCase();
  const filteredContacts = contacts.filter((contact) => {
    if (!query) return true;
    const orgNames = currentAffiliations(contact)
      .map((a) => a.clients?.name || a.vendors?.name || '')
      .join(' ')
      .toLowerCase();
    return (
      contact.name.toLowerCase().includes(query) ||
      contact.email?.toLowerCase().includes(query) ||
      contact.phone?.toLowerCase().includes(query) ||
      orgNames.includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground">People across your clients and vendors</p>
        </div>
        <PermissionGate resource="clients" action="write">
          <Button asChild>
            <Link to="/contacts/new">
              <Plus className="h-4 w-4 mr-2" />
              New Contact
            </Link>
          </Button>
        </PermissionGate>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <>
          {/* table (desktop) */}
          <div className="hidden md:block rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* cards (mobile) */}
          <div className="space-y-3 md:hidden">
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          </div>
        </>
      ) : contacts.length === 0 ? (
        <EmptyState
          icon={User}
          title="No contacts yet"
          description="Add a contact and affiliate them with a client or vendor."
          action={
            <PermissionGate resource="clients" action="write">
              <Button asChild>
                <Link to="/contacts/new">
                  <Plus className="h-4 w-4 mr-2" />
                  New Contact
                </Link>
              </Button>
            </PermissionGate>
          }
        />
      ) : (
        <>
          {/* table (desktop) */}
          <div className="hidden md:block rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <p className="text-muted-foreground">No matches for "{search}"</p>
                      <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSearch('')}>
                        Clear search
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContacts.map((contact) => {
                    const orgLabel = organisationLabel(contact);
                    const isActive = contact.is_active !== false;
                    return (
                      <TableRow key={contact.id}>
                        <TableCell>
                          <Link
                            to={`/contacts/${contact.id}`}
                            className="font-medium hover:underline"
                          >
                            {contact.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {orgLabel ? orgLabel : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>{contact.email || '-'}</TableCell>
                        <TableCell>{contact.phone || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={isActive ? 'default' : 'secondary'}>
                            {isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* cards (mobile) */}
          <div className="space-y-3 md:hidden">
            {filteredContacts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No matches for "{search}"</p>
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSearch('')}>
                  Clear search
                </Button>
              </div>
            ) : (
              filteredContacts.map((contact) => {
                const orgLabel = organisationLabel(contact);
                const isActive = contact.is_active !== false;
                return (
                  <Link
                    key={contact.id}
                    to={`/contacts/${contact.id}`}
                    className="block rounded-lg border bg-card p-4 transition-colors active:bg-muted"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">{contact.name}</span>
                      <Badge variant={isActive ? 'default' : 'secondary'}>
                        {isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    {orgLabel && <p className="text-sm text-muted-foreground">{orgLabel}</p>}
                    {(contact.email || contact.phone) && (
                      <div className="mt-2 space-y-0.5 text-sm text-muted-foreground">
                        {contact.email && <p>{contact.email}</p>}
                        {contact.phone && <p>{contact.phone}</p>}
                      </div>
                    )}
                  </Link>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
