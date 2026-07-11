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
import { useBranding } from '@/contexts/BrandingContext';
import type { Tables } from '@/integrations/supabase/types';

type Asset = Tables<'assets'> & { clients?: { name: string } | null };

const statusColors: Record<string, string> = {
  in_service: 'default',
  spare: 'secondary',
  retired: 'outline',
};

async function fetchAssets(): Promise<Asset[]> {
  const { data, error } = await supabase
    .from('assets')
    .select('*, clients:assigned_client_id(name)')
    .order('name');

  if (error) {
    console.error('Error fetching assets:', error);
    return [];
  }
  return (data as any) || [];
}

export default function Assets() {
  const [search, setSearch] = useState('');
  const { formatCurrency } = useBranding();
  const { data: assets = [], isLoading: loading } = useQuery({
    queryKey: ['assets'],
    queryFn: fetchAssets,
  });

  const filteredAssets = assets.filter(asset => 
    asset.name.toLowerCase().includes(search.toLowerCase()) ||
    asset.asset_tag.toLowerCase().includes(search.toLowerCase()) ||
    asset.serial_number?.toLowerCase().includes(search.toLowerCase()) ||
    asset.clients?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assets</h1>
          <p className="text-muted-foreground">Track equipment and hardware</p>
        </div>
        <PermissionGate resource="assets" action="write">
          <Button asChild>
            <Link to="/assets/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Asset
            </Link>
          </Button>
        </PermissionGate>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search assets..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* table (desktop) */}
      <div className="hidden md:block rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset Tag</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Default Rate</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredAssets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No assets found
                </TableCell>
              </TableRow>
            ) : (
              filteredAssets.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell className="font-mono text-sm">{asset.asset_tag}</TableCell>
                  <TableCell>
                    <Link
                      to={`/assets/${asset.id}`}
                      className="font-medium hover:underline"
                    >
                      {asset.name}
                    </Link>
                  </TableCell>
                  <TableCell>{asset.asset_type || '-'}</TableCell>
                  <TableCell>
                    {asset.clients?.name ? (
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        {asset.clients.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Available</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {asset.default_rental_rate ? (
                      <span className="text-sm">
                        {formatCurrency(asset.default_rental_rate)}/{asset.default_billing_frequency || 'monthly'}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusColors[asset.status] as any || 'secondary'}>
                      {asset.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* cards (mobile) */}
      <div className="space-y-3 md:hidden">
        {loading ? (
          <p className="text-center py-8 text-muted-foreground">Loading...</p>
        ) : filteredAssets.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No assets found</p>
        ) : (
          filteredAssets.map((asset) => (
            <Link
              key={asset.id}
              to={`/assets/${asset.id}`}
              className="block rounded-lg border bg-card p-4 transition-colors active:bg-muted"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-medium">{asset.name}</span>
                  <p className="text-sm text-muted-foreground font-mono">{asset.asset_tag}</p>
                </div>
                <Badge variant={statusColors[asset.status] as any || 'secondary'}>
                  {asset.status.replace('_', ' ')}
                </Badge>
              </div>
              <div className="mt-2 text-sm">
                {asset.clients?.name ? (
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    {asset.clients.name}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Available</span>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
