import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { useBranding } from '@/contexts/BrandingContext';
import { downloadCsv } from '@/lib/csv';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface JobPL {
  id: string;
  job_number: string;
  name: string;
  client_name: string;
  status: string;
  revenue: number;
  labourCost: number;
  expenseCost: number;
  purchaseCost: number;
  writtenOff: number;
  profit: number;
  margin: number;
}

export default function JobProfitLossReport() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<JobPL[]>([]);
  const [totals, setTotals] = useState({ revenue: 0, labour: 0, expenses: 0, purchases: 0, writtenOff: 0, profit: 0 });
  const { formatCurrency } = useBranding();

  async function fetchReport() {
    setLoading(true);

    // Fetch all jobs with client info
    const { data: jobsData } = await supabase
      .from('jobs')
      .select('id, job_number, name, status, hourly_rate, clients(name)')
      .order('created_at', { ascending: false });

    // Fetch all paid/partially paid invoices grouped by job
    const { data: invoices } = await supabase
      .from('invoices')
      .select('job_id, total, amount_paid, status')
      .not('job_id', 'is', null);

    // Fetch all timesheets with rates
    const { data: timesheets } = await supabase
      .from('timesheets')
      .select('job_id, hours, rate_override, user_id, profiles(hourly_rate)');

    // Fetch all expenses by job
    const { data: expenses } = await supabase
      .from('expenses')
      .select('job_id, amount')
      .not('job_id', 'is', null);

    // Fetch purchase allocations for job expenses
    const { data: purchaseAllocations } = await supabase
      .from('purchase_allocations')
      .select('job_id, amount')
      .eq('allocation_type', 'job_expense')
      .not('job_id', 'is', null);

    // Calculate per job
    const jobMap = new Map<string, JobPL>();

    (jobsData || []).forEach(job => {
      jobMap.set(job.id, {
        id: job.id,
        job_number: job.job_number,
        name: job.name,
        client_name: (job.clients as any)?.name || 'No Client',
        status: job.status,
        revenue: 0,
        labourCost: 0,
        expenseCost: 0,
        purchaseCost: 0,
        writtenOff: 0,
        profit: 0,
        margin: 0,
      });
    });

    // Add revenue from invoices
    (invoices || []).forEach(inv => {
      if (inv.job_id && jobMap.has(inv.job_id)) {
        const job = jobMap.get(inv.job_id)!;
        if (inv.status === 'paid' || inv.status === 'partially_paid') {
          job.revenue += inv.amount_paid || 0;
        }
        if (inv.status === 'written_off') {
          job.writtenOff += (inv.total || 0) - (inv.amount_paid || 0);
        }
      }
    });

    // Add labour costs from timesheets (using profile hourly rate as cost)
    (timesheets || []).forEach(ts => {
      if (ts.job_id && jobMap.has(ts.job_id)) {
        const job = jobMap.get(ts.job_id)!;
        const rate = ts.rate_override || (ts.profiles as any)?.hourly_rate || 0;
        // Assume cost is 60% of billable rate for simplicity
        job.labourCost += (ts.hours || 0) * rate * 0.6;
      }
    });

    // Add expenses
    (expenses || []).forEach(exp => {
      if (exp.job_id && jobMap.has(exp.job_id)) {
        const job = jobMap.get(exp.job_id)!;
        job.expenseCost += exp.amount || 0;
      }
    });

    // Add purchase allocations
    (purchaseAllocations || []).forEach(alloc => {
      if (alloc.job_id && jobMap.has(alloc.job_id)) {
        const job = jobMap.get(alloc.job_id)!;
        job.purchaseCost += alloc.amount || 0;
      }
    });

    // Calculate profit and margin
    jobMap.forEach(job => {
      job.profit = job.revenue - job.labourCost - job.expenseCost - job.purchaseCost - job.writtenOff;
      job.margin = job.revenue > 0 ? (job.profit / job.revenue) * 100 : 0;
    });

    const jobList = Array.from(jobMap.values()).sort((a, b) => b.revenue - a.revenue);

    // Calculate totals
    const totalRevenue = jobList.reduce((sum, j) => sum + j.revenue, 0);
    const totalLabour = jobList.reduce((sum, j) => sum + j.labourCost, 0);
    const totalExpenses = jobList.reduce((sum, j) => sum + j.expenseCost, 0);
    const totalPurchases = jobList.reduce((sum, j) => sum + j.purchaseCost, 0);
    const totalWrittenOff = jobList.reduce((sum, j) => sum + j.writtenOff, 0);
    const totalProfit = jobList.reduce((sum, j) => sum + j.profit, 0);

    setJobs(jobList);
    setTotals({ revenue: totalRevenue, labour: totalLabour, expenses: totalExpenses, purchases: totalPurchases, writtenOff: totalWrittenOff, profit: totalProfit });
    setLoading(false);
  }

  useEffect(() => {
    fetchReport();
  }, []);

  function handleExportCsv() {
    const headers = ['Job Number', 'Job Name', 'Client', 'Status', 'Revenue', 'Labour', 'Expenses', 'Purchases', 'Written Off', 'Profit', 'Margin'];
    const rows = jobs.map((job) => [
      job.job_number,
      job.name,
      job.client_name,
      job.status,
      round2(job.revenue),
      round2(job.labourCost),
      round2(job.expenseCost),
      round2(job.purchaseCost),
      round2(job.writtenOff),
      round2(job.profit),
      round2(job.margin),
    ]);

    downloadCsv('job-profit-loss.csv', headers, rows);
  }

  const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    prospect: 'secondary',
    active: 'default',
    on_hold: 'outline',
    complete: 'default',
    archived: 'secondary',
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totals.revenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Labour Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.labour)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.expenses)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Purchases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.purchases)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Written Off</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(totals.writtenOff)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totals.profit)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Job Profitability</CardTitle>
          <Button variant="outline" onClick={handleExportCsv} disabled={jobs.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Labour</TableHead>
                <TableHead className="text-right">Expenses</TableHead>
                <TableHead className="text-right">Purchases</TableHead>
                <TableHead className="text-right">Written Off</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    No jobs found
                  </TableCell>
                </TableRow>
              ) : (
                jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Link to={`/jobs/${job.id}`} className="font-medium hover:underline">
                        {job.job_number} - {job.name}
                      </Link>
                    </TableCell>
                    <TableCell>{job.client_name}</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[job.status] || 'secondary'}>
                        {job.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(job.revenue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(job.labourCost)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(job.expenseCost)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(job.purchaseCost)}</TableCell>
                    <TableCell className="text-right text-orange-600">{formatCurrency(job.writtenOff)}</TableCell>
                    <TableCell className={`text-right font-medium ${job.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(job.profit)}
                    </TableCell>
                    <TableCell className={`text-right ${job.margin >= 0 ? '' : 'text-red-600'}`}>
                      {job.margin.toFixed(1)}%
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
