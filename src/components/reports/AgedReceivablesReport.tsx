import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { differenceInDays } from 'date-fns';
import { useBranding } from '@/contexts/BrandingContext';

interface Receivable {
  id: string;
  invoice_number: string;
  client_name: string;
  issue_date: string;
  due_date: string;
  total: number;
  amount_paid: number;
  outstanding: number;
  days_overdue: number;
  bucket: string;
}

interface AgingBuckets {
  current: number;
  days30: number;
  days60: number;
  days90: number;
  total: number;
}

export default function AgedReceivablesReport() {
  const [loading, setLoading] = useState(true);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [buckets, setBuckets] = useState<AgingBuckets>({ current: 0, days30: 0, days60: 0, days90: 0, total: 0 });
  const { formatCurrency } = useBranding();

  async function fetchReport() {
    setLoading(true);

    // Fetch unpaid/partially paid invoices (excluding written_off and void)
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, invoice_number, issue_date, due_date, total, amount_paid, status, clients(name)')
      .in('status', ['sent', 'partially_paid', 'overdue'])
      .order('due_date', { ascending: true });

    const today = new Date();
    const receivableList: Receivable[] = [];
    const agingBuckets: AgingBuckets = { current: 0, days30: 0, days60: 0, days90: 0, total: 0 };

    (invoices || []).forEach(inv => {
      const outstanding = (inv.total || 0) - (inv.amount_paid || 0);
      if (outstanding <= 0) return;

      const dueDate = new Date(inv.due_date);
      const daysOverdue = differenceInDays(today, dueDate);

      let bucket = 'Current';
      if (daysOverdue > 90) {
        bucket = '90+ Days';
        agingBuckets.days90 += outstanding;
      } else if (daysOverdue > 60) {
        bucket = '61-90 Days';
        agingBuckets.days60 += outstanding;
      } else if (daysOverdue > 30) {
        bucket = '31-60 Days';
        agingBuckets.days30 += outstanding;
      } else if (daysOverdue > 0) {
        bucket = '1-30 Days';
        agingBuckets.days30 += outstanding;
      } else {
        agingBuckets.current += outstanding;
      }

      agingBuckets.total += outstanding;

      receivableList.push({
        id: inv.id,
        invoice_number: inv.invoice_number,
        client_name: (inv.clients as any)?.name || 'Unknown',
        issue_date: inv.issue_date,
        due_date: inv.due_date,
        total: inv.total || 0,
        amount_paid: inv.amount_paid || 0,
        outstanding,
        days_overdue: daysOverdue,
        bucket,
      });
    });

    setReceivables(receivableList);
    setBuckets(agingBuckets);
    setLoading(false);
  }

  useEffect(() => {
    fetchReport();
  }, []);

  const getBucketColor = (bucket: string) => {
    switch (bucket) {
      case 'Current': return 'default';
      case '1-30 Days': return 'outline';
      case '31-60 Days': return 'secondary';
      case '61-90 Days': return 'destructive';
      case '90+ Days': return 'destructive';
      default: return 'default';
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(buckets.current)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">1-30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(buckets.days30)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">31-60 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(buckets.days60)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">90+ Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(buckets.days90)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(buckets.total)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Outstanding Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Aging</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receivables.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No outstanding receivables
                  </TableCell>
                </TableRow>
              ) : (
                receivables.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Link to={`/invoices/${inv.id}`} className="font-medium hover:underline">
                        {inv.invoice_number}
                      </Link>
                    </TableCell>
                    <TableCell>{inv.client_name}</TableCell>
                    <TableCell>{new Date(inv.issue_date).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(inv.due_date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">{formatCurrency(inv.total)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(inv.amount_paid)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(inv.outstanding)}</TableCell>
                    <TableCell>
                      <Badge variant={getBucketColor(inv.bucket) as any}>
                        {inv.bucket}
                        {inv.days_overdue > 0 && ` (${inv.days_overdue}d)`}
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
  );
}
