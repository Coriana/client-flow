import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfYear, endOfYear } from 'date-fns';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ClientRevenue {
  client_id: string;
  client_name: string;
  invoice_count: number;
  total_revenue: number;
  paid_amount: number;
  outstanding: number;
}

export default function RevenueByClientReport() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ClientRevenue[]>([]);
  const [startDate, setStartDate] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfYear(new Date()), 'yyyy-MM-dd'));

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
  };

  const fetchReport = async () => {
    setLoading(true);
    
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('id, total, amount_paid, status, issue_date, client_id, clients(id, name)')
      .gte('issue_date', startDate)
      .lte('issue_date', endDate)
      .not('status', 'in', '("void","draft")');

    if (error) {
      console.error('Error fetching invoices:', error);
      setLoading(false);
      return;
    }

    const clientMap = new Map<string, ClientRevenue>();

    invoices?.forEach(inv => {
      const clientId = inv.client_id;
      const clientName = (inv.clients as any)?.name || 'Unknown';
      
      if (!clientMap.has(clientId)) {
        clientMap.set(clientId, {
          client_id: clientId,
          client_name: clientName,
          invoice_count: 0,
          total_revenue: 0,
          paid_amount: 0,
          outstanding: 0,
        });
      }
      
      const entry = clientMap.get(clientId)!;
      entry.invoice_count++;
      entry.total_revenue += Number(inv.total) || 0;
      entry.paid_amount += Number(inv.amount_paid) || 0;
      entry.outstanding += (Number(inv.total) || 0) - (Number(inv.amount_paid) || 0);
    });

    const sorted = Array.from(clientMap.values()).sort((a, b) => b.total_revenue - a.total_revenue);
    setData(sorted);
    setLoading(false);
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const totalRevenue = data.reduce((sum, c) => sum + c.total_revenue, 0);
  const chartData = data.slice(0, 10).map(c => ({
    name: c.client_name.length > 15 ? c.client_name.substring(0, 15) + '...' : c.client_name,
    revenue: c.total_revenue,
  }));

  if (loading) return <div className="text-muted-foreground">Loading report...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end flex-wrap">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <Button onClick={fetchReport}>Generate Report</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top 10 Clients by Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                <YAxis type="category" dataKey="name" width={120} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Revenue by Client ({data.length} clients)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Invoices</TableHead>
                <TableHead className="text-right">Total Revenue</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="text-right">% of Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(row => (
                <TableRow key={row.client_id}>
                  <TableCell>
                    <Link to={`/clients/${row.client_id}`} className="text-primary hover:underline">
                      {row.client_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">{row.invoice_count}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(row.total_revenue)}</TableCell>
                  <TableCell className="text-right text-green-600">{formatCurrency(row.paid_amount)}</TableCell>
                  <TableCell className="text-right text-amber-600">{formatCurrency(row.outstanding)}</TableCell>
                  <TableCell className="text-right">{totalRevenue > 0 ? ((row.total_revenue / totalRevenue) * 100).toFixed(1) : 0}%</TableCell>
                </TableRow>
              ))}
              {data.length > 0 && (
                <TableRow className="font-bold bg-muted/50">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{data.reduce((s, c) => s + c.invoice_count, 0)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalRevenue)}</TableCell>
                  <TableCell className="text-right text-green-600">{formatCurrency(data.reduce((s, c) => s + c.paid_amount, 0))}</TableCell>
                  <TableCell className="text-right text-amber-600">{formatCurrency(data.reduce((s, c) => s + c.outstanding, 0))}</TableCell>
                  <TableCell className="text-right">100%</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {data.length === 0 && <p className="text-center text-muted-foreground py-8">No invoices found for the selected period.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
