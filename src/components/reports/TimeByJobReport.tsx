import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useBranding } from '@/contexts/BrandingContext';

interface JobTime {
  job_id: string;
  job_number: string;
  job_name: string;
  client_name: string;
  client_id: string;
  billable_hours: number;
  non_billable_hours: number;
  total_hours: number;
  billable_value: number;
}

export default function TimeByJobReport() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<JobTime[]>([]);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const { formatCurrency } = useBranding();

  const fetchReport = async () => {
    setLoading(true);
    
    // Fetch timesheets with job and profile relations (flat, no nested)
    const { data: timesheets, error } = await supabase
      .from('timesheets')
      .select('id, hours, is_billable, rate_override, job_id, user_id, jobs(id, job_number, name, hourly_rate, client_id), profiles(hourly_rate)')
      .gte('date', startDate)
      .lte('date', endDate);

    if (error) {
      console.error('Error fetching timesheets:', error);
      setLoading(false);
      return;
    }

    // Get unique client IDs from jobs and fetch clients separately
    const clientIds = [...new Set(timesheets?.map(ts => (ts.jobs as any)?.client_id).filter(Boolean) || [])];
    let clientMap: Record<string, string> = {};
    
    if (clientIds.length > 0) {
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name')
        .in('id', clientIds);
      
      clientMap = (clients || []).reduce((acc, c) => {
        acc[c.id] = c.name;
        return acc;
      }, {} as Record<string, string>);
    }

    const jobMap = new Map<string, JobTime>();

    timesheets?.forEach(ts => {
      const job = ts.jobs as any;
      if (!job) return;
      
      const jobId = job.id;
      
      if (!jobMap.has(jobId)) {
        jobMap.set(jobId, {
          job_id: jobId,
          job_number: job.job_number,
          job_name: job.name,
          client_name: clientMap[job.client_id] || 'No Client',
          client_id: job.client_id,
          billable_hours: 0,
          non_billable_hours: 0,
          total_hours: 0,
          billable_value: 0,
        });
      }
      
      const entry = jobMap.get(jobId)!;
      const hours = Number(ts.hours) || 0;
      entry.total_hours += hours;
      
      if (ts.is_billable) {
        entry.billable_hours += hours;
        const rate = ts.rate_override || job.hourly_rate || (ts.profiles as any)?.hourly_rate || 0;
        entry.billable_value += hours * Number(rate);
      } else {
        entry.non_billable_hours += hours;
      }
    });

    const sorted = Array.from(jobMap.values()).sort((a, b) => b.total_hours - a.total_hours);
    setData(sorted);
    setLoading(false);
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const totals = {
    billable: data.reduce((s, j) => s + j.billable_hours, 0),
    nonBillable: data.reduce((s, j) => s + j.non_billable_hours, 0),
    total: data.reduce((s, j) => s + j.total_hours, 0),
    value: data.reduce((s, j) => s + j.billable_value, 0),
  };

  const chartData = data.slice(0, 10).map(j => ({
    name: j.job_number,
    billable: j.billable_hours,
    nonBillable: j.non_billable_hours,
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.total.toFixed(1)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Billable Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totals.billable.toFixed(1)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Non-Billable Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{totals.nonBillable.toFixed(1)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Billable Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.value)}</div>
          </CardContent>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Jobs by Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="billable" name="Billable" fill="hsl(var(--primary))" stackId="a" />
                  <Bar dataKey="nonBillable" name="Non-Billable" fill="hsl(var(--muted))" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Time by Job ({data.length} jobs)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Billable Hrs</TableHead>
                <TableHead className="text-right">Non-Billable Hrs</TableHead>
                <TableHead className="text-right">Total Hrs</TableHead>
                <TableHead className="text-right">Billable Value</TableHead>
                <TableHead className="text-right">Utilization</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(row => (
                <TableRow key={row.job_id}>
                  <TableCell>
                    <Link to={`/jobs/${row.job_id}`} className="text-primary hover:underline font-medium">
                      {row.job_number}
                    </Link>
                    <div className="text-sm text-muted-foreground">{row.job_name}</div>
                  </TableCell>
                  <TableCell>
                    {row.client_id ? (
                      <Link to={`/clients/${row.client_id}`} className="hover:underline">{row.client_name}</Link>
                    ) : row.client_name}
                  </TableCell>
                  <TableCell className="text-right text-green-600">{row.billable_hours.toFixed(1)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{row.non_billable_hours.toFixed(1)}</TableCell>
                  <TableCell className="text-right font-medium">{row.total_hours.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.billable_value)}</TableCell>
                  <TableCell className="text-right">
                    {row.total_hours > 0 ? ((row.billable_hours / row.total_hours) * 100).toFixed(0) : 0}%
                  </TableCell>
                </TableRow>
              ))}
              {data.length > 0 && (
                <TableRow className="font-bold bg-muted/50">
                  <TableCell colSpan={2}>Total</TableCell>
                  <TableCell className="text-right text-green-600">{totals.billable.toFixed(1)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{totals.nonBillable.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{totals.total.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totals.value)}</TableCell>
                  <TableCell className="text-right">
                    {totals.total > 0 ? ((totals.billable / totals.total) * 100).toFixed(0) : 0}%
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {data.length === 0 && <p className="text-center text-muted-foreground py-8">No time entries found.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
