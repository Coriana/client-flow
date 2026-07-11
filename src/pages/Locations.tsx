import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, MapPin, Building2, Phone, Mail } from 'lucide-react';

interface Location {
  id: string;
  name: string;
  location_type: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  vendor_count?: number;
  client_count?: number;
  asset_count?: number;
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

async function fetchLocations(): Promise<Location[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('name');

  if (error || !data) {
    return [];
  }

  // Fetch linked entity counts
  const locationsWithCounts = await Promise.all(
    data.map(async (location) => {
      const [vendors, clients, assets] = await Promise.all([
        supabase.from('vendors').select('id', { count: 'exact', head: true }).eq('location_id', location.id),
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('location_id', location.id),
        supabase.from('assets').select('id', { count: 'exact', head: true }).eq('location_id', location.id),
      ]);

      return {
        ...location,
        vendor_count: vendors.count || 0,
        client_count: clients.count || 0,
        asset_count: assets.count || 0,
      };
    })
  );
  return locationsWithCounts;
}

export default function Locations() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const { data: locations = [], isLoading: loading } = useQuery({
    queryKey: ['locations'],
    queryFn: fetchLocations,
  });

  const filteredLocations = locations.filter((location) => {
    const matchesSearch =
      searchQuery === '' ||
      location.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      location.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      location.address_line1?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = typeFilter === 'all' || location.location_type === typeFilter;

    return matchesSearch && matchesType;
  });

  function formatAddress(location: Location) {
    const parts = [location.address_line1, location.city, location.state, location.postcode].filter(Boolean);
    return parts.join(', ') || 'No address';
  }

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Locations</h1>
          <p className="text-muted-foreground">Manage physical locations for vendors, clients, and assets</p>
        </div>
        <Button onClick={() => navigate('/locations/new')}>
          <Plus className="h-4 w-4 mr-2" />
          New Location
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search locations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {LOCATION_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{locations.length}</p>
                <p className="text-sm text-muted-foreground">Total Locations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Building2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {locations.filter((l) => l.is_active).length}
                </p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {locations.reduce((sum, l) => sum + (l.client_count || 0), 0)}
                </p>
                <p className="text-sm text-muted-foreground">Linked Clients</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Building2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {locations.reduce((sum, l) => sum + (l.asset_count || 0), 0)}
                </p>
                <p className="text-sm text-muted-foreground">Linked Assets</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Locations Table (desktop) */}
      <div className="hidden md:block">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Linked</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLocations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <MapPin className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No locations found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLocations.map((location) => (
                    <TableRow
                      key={location.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/locations/${location.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{location.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {location.location_type && (
                          <Badge variant="outline">{location.location_type}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                        {formatAddress(location)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm">
                          {location.phone && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {location.phone}
                            </span>
                          )}
                          {location.email && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {location.email}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 text-xs">
                          <Badge variant="secondary">{location.client_count} clients</Badge>
                          <Badge variant="secondary">{location.vendor_count} vendors</Badge>
                          <Badge variant="secondary">{location.asset_count} assets</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={location.is_active ? 'default' : 'secondary'}>
                          {location.is_active ? 'Active' : 'Inactive'}
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

      {/* Locations cards (mobile) */}
      <div className="space-y-3 md:hidden">
        {filteredLocations.length === 0 ? (
          <div className="rounded-lg border p-8 text-center">
            <MapPin className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No locations found</p>
          </div>
        ) : (
          filteredLocations.map((location) => (
            <Link
              key={location.id}
              to={`/locations/${location.id}`}
              className="block rounded-lg border bg-card p-4 transition-colors active:bg-muted"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{location.name}</span>
                </div>
                <Badge variant={location.is_active ? 'default' : 'secondary'}>
                  {location.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{formatAddress(location)}</p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
