import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, startOfYear } from 'date-fns';
import { Link } from 'react-router-dom';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { Download } from 'lucide-react';
import { useBranding } from '@/contexts/BrandingContext';
import { downloadCsv } from '@/lib/csv';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface VendorSpend {
  id: string | null;
  name: string;
  purchaseCount: number;
  totalAmount: number;
  percentage: number;
}

export default function VendorSpendReport() {
  const [startDate, setStartDate] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState<VendorSpend[]>([]);
  const [totals, setTotals] = useState({ totalSpend: 0, vendorCount: 0, purchaseCount: 0 });
  const { formatCurrency } = useBranding();

  async function fetchReport() {
    setLoading(true);

    // Fetch purchases with vendor info
    const { data: purchases } = await supabase
      .from('purchases')
      .select('id, vendor_id, vendor_name, total, vendors(id, name)')
      .gte('date', startDate)
      .lte('date', endDate);

    // Aggregate by vendor
    const vendorMap = new Map<string, VendorSpend>();

    (purchases || []).forEach(purchase => {
      const vendorId = purchase.vendor_id || 'no-vendor';
      const vendorName = (purchase.vendors as any)?.name || purchase.vendor_name || 'Uncategorized';
      
      if (!vendorMap.has(vendorId)) {
        vendorMap.set(vendorId, {
          id: purchase.vendor_id,
          name: vendorName,
          purchaseCount: 0,
          totalAmount: 0,
          percentage: 0,
        });
      }
      
      const vendor = vendorMap.get(vendorId)!;
      vendor.purchaseCount++;
      vendor.totalAmount += purchase.total || 0;
    });

    const totalSpend = Array.from(vendorMap.values()).reduce((sum, v) => sum + v.totalAmount, 0);

    // Calculate percentages and sort
    const vendorList = Array.from(vendorMap.values())
      .map(v => ({
        ...v,
        percentage: totalSpend > 0 ? (v.totalAmount / totalSpend) * 100 : 0,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    setVendors(vendorList);
    setTotals({
      totalSpend,
      vendorCount: vendorList.filter(v => v.id !== null).length,
      purchaseCount: (purchases || []).length,
    });
    setLoading(false);
  }

  useEffect(() => {
    fetchReport();
  }, []);

  const chartData = vendors.slice(0, 10).map(v => ({
    name: v.name.length > 15 ? v.name.substring(0, 15) + '...' : v.name,
    spend: v.totalAmount,
  }));

  const chartConfig = {
    spend: {
      label: 'Spend',
      color: 'hsl(var(--chart-1))',
    },
  };

  function handleExportCsv() {
    const headers = ['Vendor', 'Purchases', 'Total Amount', '% of Total'];
    const rows = vendors.map((vendor) => [
      vendor.name,
      vendor.purchaseCount,
      round2(vendor.totalAmount),
      round2(vendor.percentage),
    ]);

    if (vendors.length > 0) {
      rows.push(['Total', totals.purchaseCount, round2(totals.totalSpend), 100]);
    }

    downloadCsv(`vendor-spend-${startDate}-to-${endDate}.csv`, headers, rows);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <Button onClick={fetchReport} disabled={loading}>
              {loading ? 'Loading...' : 'Run Report'}
            </Button>
            <Button variant="outline" onClick={handleExportCsv} disabled={vendors.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Spend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totals.totalSpend)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vendors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.vendorCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Purchases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.purchaseCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Top Vendors Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Vendors by Spend</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} />
                  <YAxis type="category" dataKey="name" width={120} />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="spend" fill="var(--color-spend)" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Vendor Table */}
      <Card>
        <CardHeader>
          <CardTitle>Spending by Vendor</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Purchases</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead className="text-right">% of Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No purchases in date range
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {vendors.map((vendor, i) => (
                    <TableRow key={vendor.id || i}>
                      <TableCell>
                        {vendor.id ? (
                          <Link to={`/vendors/${vendor.id}`} className="font-medium hover:underline">
                            {vendor.name}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">{vendor.name}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{vendor.purchaseCount}</TableCell>
                      <TableCell className="text-right">{formatCurrency(vendor.totalAmount)}</TableCell>
                      <TableCell className="text-right">{vendor.percentage.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold border-t-2">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{totals.purchaseCount}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.totalSpend)}</TableCell>
                    <TableCell className="text-right">100%</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
