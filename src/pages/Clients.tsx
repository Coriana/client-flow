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
import { Plus, Search } from 'lucide-react';
import { PermissionGate } from '@/components/PermissionGate';
import type { Tables } from '@/integrations/supabase/types';

type Client = Tables<'clients'>;
type Contact = Tables<'client_contacts'>;

type ClientWithContact = Client & { primary_contact?: Contact | null };

async function fetchClients(): Promise<ClientWithContact[]> {
  const { data: clientsData, error } = await supabase
    .from('clients')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error fetching clients:', error);
    return [];
  }

  // Fetch primary contacts for all clients
  const { data: contacts } = await supabase
    .from('client_contacts')
    .select('*')
    .eq('is_primary', true)
    .eq('is_active', true);

  const contactMap = new Map<string, Contact>();
  contacts?.forEach(c => contactMap.set(c.client_id, c));

  return (clientsData || []).map(client => ({
    ...client,
    primary_contact: contactMap.get(client.id) || null,
  }));
}

export default function Clients() {
  const [search, setSearch] = useState('');
  const { data: clients = [], isLoading: loading } = useQuery({
    queryKey: ['clients'],
    queryFn: fetchClients,
  });

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(search.toLowerCase()) ||
    client.trading_name?.toLowerCase().includes(search.toLowerCase()) ||
    client.primary_contact?.email?.toLowerCase().includes(search.toLowerCase()) ||
    client.primary_contact?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">Manage your client relationships</p>
        </div>
        <PermissionGate resource="clients" action="write">
          <Button asChild>
            <Link to="/clients/new">
              <Plus className="h-4 w-4 mr-2" />
              New Client
            </Link>
          </Button>
        </PermissionGate>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No clients found
                </TableCell>
              </TableRow>
            ) : (
              filteredClients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <Link 
                      to={`/clients/${client.id}`}
                      className="font-medium hover:underline"
                    >
                      {client.name}
                    </Link>
                    {client.trading_name && (
                      <p className="text-sm text-muted-foreground">
                        T/A {client.trading_name}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>{client.primary_contact?.name || '-'}</TableCell>
                  <TableCell>{client.primary_contact?.email || '-'}</TableCell>
                  <TableCell>{client.primary_contact?.phone || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={client.is_active ? 'default' : 'secondary'}>
                      {client.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
