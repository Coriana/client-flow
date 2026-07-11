import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInYears, differenceInMonths } from 'date-fns';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { useBranding } from '@/contexts/BrandingContext';
import { downloadCsv } from '@/lib/csv';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface Asset {
  id: string;
  asset_tag: string;
  name: string;
  asset_type: string | null;
  serial_number: string | null;
  status: string;
  purchase_date: string | null;
  purchase_cost: number | null;
  warranty_end: string | null;
  location: string | null;
  assigned_client_name: string | null;
  assigned_client_id: string | null;
  is_rental: boolean;
  monthly_rate: number | null;
  age_years: number;
  age_months: number;
}

export default function AssetRegisterReport() {
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const { formatCurrency } = useBranding();

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      in_service: 'default',
      spare: 'secondary',
      retired: 'destructive',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status.replace('_', ' ')}</Badge>;
  };

  const fetchReport = async () => {
    setLoading(true);
    
    let query = supabase
      .from('assets')
      .select('*, assigned_client:assigned_client_id(id, name)')
      .order('asset_tag');

    type AssetStatus = 'in_service' | 'spare' | 'retired';

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter as AssetStatus);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching assets:', error);
      setLoading(false);
      return;
    }

    const now = new Date();
    const mapped = data?.map(asset => {
      const purchaseDate = asset.purchase_date ? new Date(asset.purchase_date) : null;
      return {
        id: asset.id,
        asset_tag: asset.asset_tag,
        name: asset.name,
        asset_type: asset.asset_type,
        serial_number: asset.serial_number,
        status: asset.status,
        purchase_date: asset.purchase_date,
        purchase_cost: asset.purchase_cost ? Number(asset.purchase_cost) : null,
        warranty_end: asset.warranty_end,
        location: asset.location,
        assigned_client_name: (asset.assigned_client as any)?.name || null,
        assigned_client_id: asset.assigned_client_id,
        is_rental: asset.is_rental || false,
        monthly_rate: asset.monthly_rate ? Number(asset.monthly_rate) : null,
        age_years: purchaseDate ? differenceInYears(now, purchaseDate) : 0,
        age_months: purchaseDate ? differenceInMonths(now, purchaseDate) % 12 : 0,
      };
    }) || [];

    let filtered = mapped;
    if (typeFilter !== 'all') {
      filtered = mapped.filter(a => (a.asset_type || 'Uncategorized') === typeFilter);
    }

    setAssets(filtered);
    setLoading(false);
  };

  useEffect(() => {
    fetchReport();
  }, [statusFilter, typeFilter]);

  const assetTypes = [...new Set(assets.map(a => a.asset_type || 'Uncategorized'))].sort();
  
  const totals = {
    count: assets.length,
    inService: assets.filter(a => a.status === 'in_service').length,
    spare: assets.filter(a => a.status === 'spare').length,
    retired: assets.filter(a => a.status === 'retired').length,
    totalCost: assets.reduce((s, a) => s + (a.purchase_cost || 0), 0),
    rentals: assets.filter(a => a.is_rental).length,
    monthlyRentalIncome: assets.filter(a => a.is_rental && a.status === 'in_service').reduce((s, a) => s + (a.monthly_rate || 0), 0),
    warrantyExpiring: assets.filter(a => {
      if (!a.warranty_end) return false;
      const end = new Date(a.warranty_end);
      const threeMonths = new Date();
      threeMonths.setMonth(threeMonths.getMonth() + 3);
      return end <= threeMonths && end >= new Date();
    }).length,
  };

  function getWarrantyStatus(asset: Asset): string {
    if (!asset.warranty_end) return '';
    const end = new Date(asset.warranty_end);
    if (end < new Date()) return 'Expired';
    const threeMonths = new Date();
    threeMonths.setMonth(threeMonths.getMonth() + 3);
    return end <= threeMonths ? 'Expiring Soon' : 'OK';
  }

  function handleExportCsv() {
    const headers = ['Asset Tag', 'Name', 'Type', 'Serial #', 'Status', 'Purchase Date', 'Cost', 'Age Years', 'Age Months', 'Warranty End', 'Warranty Status', 'Client', 'Location'];
    const rows = assets.map((asset) => [
      asset.asset_tag,
      asset.name,
      asset.asset_type || '',
      asset.serial_number || '',
      asset.status,
      asset.purchase_date || '',
      asset.purchase_cost !== null ? round2(asset.purchase_cost) : '',
      asset.age_years,
      asset.age_months,
      asset.warranty_end || '',
      getWarrantyStatus(asset),
      asset.assigned_client_id ? asset.assigned_client_name || '' : '',
      asset.assigned_client_id ? '' : asset.location || '',
    ]);

    downloadCsv('asset-register.csv', headers, rows);
  }

  if (loading) return <div className="text-muted-foreground">Loading report...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end flex-wrap">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="in_service">In Service</SelectItem>
                  <SelectItem value="spare">Spare</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {assetTypes.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Service</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totals.inService}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Spare</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{totals.spare}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Retired</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{totals.retired}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.totalCost)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rentals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.rentals}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Rental</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totals.monthlyRentalIncome)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Warranty Expiring</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{totals.warrantyExpiring}</div>
            <p className="text-xs text-muted-foreground">within 3 months</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Asset Register</CardTitle>
          <Button variant="outline" onClick={handleExportCsv} disabled={assets.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset Tag</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Serial #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Purchase Date</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Warranty</TableHead>
                <TableHead>Location/Client</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map(asset => {
                const warrantyExpired = asset.warranty_end && new Date(asset.warranty_end) < new Date();
                const warrantyExpiring = asset.warranty_end && !warrantyExpired && (() => {
                  const end = new Date(asset.warranty_end);
                  const threeMonths = new Date();
                  threeMonths.setMonth(threeMonths.getMonth() + 3);
                  return end <= threeMonths;
                })();
                
                return (
                  <TableRow key={asset.id} className={asset.status === 'retired' ? 'opacity-50' : ''}>
                    <TableCell>
                      <Link to={`/assets/${asset.id}`} className="text-primary hover:underline font-mono">
                        {asset.asset_tag}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{asset.name}</TableCell>
                    <TableCell>{asset.asset_type || '-'}</TableCell>
                    <TableCell className="font-mono text-sm">{asset.serial_number || '-'}</TableCell>
                    <TableCell>{getStatusBadge(asset.status)}</TableCell>
                    <TableCell>
                      {asset.purchase_date ? format(new Date(asset.purchase_date), 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {asset.purchase_cost ? formatCurrency(asset.purchase_cost) : '-'}
                    </TableCell>
                    <TableCell>
                      {asset.purchase_date ? (
                        <span>
                          {asset.age_years > 0 && `${asset.age_years}y `}
                          {asset.age_months}m
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {asset.warranty_end ? (
                        <span className={warrantyExpired ? 'text-destructive' : warrantyExpiring ? 'text-amber-600' : ''}>
                          {format(new Date(asset.warranty_end), 'dd/MM/yyyy')}
                          {warrantyExpired && ' (Expired)'}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {asset.assigned_client_id ? (
                        <Link to={`/clients/${asset.assigned_client_id}`} className="hover:underline">
                          {asset.assigned_client_name}
                        </Link>
                      ) : asset.location || '-'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {assets.length === 0 && <p className="text-center text-muted-foreground py-8">No assets found.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
