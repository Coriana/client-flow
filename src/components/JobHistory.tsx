import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, FileText, DollarSign, Package, AlertCircle, 
  Wrench, Users, TrendingUp, History 
} from 'lucide-react';

interface HistoryEvent {
  id: string;
  type: 'timesheet' | 'expense' | 'invoice' | 'job_asset' | 'issue' | 'inventory' | 'status_change';
  date: string;
  title: string;
  description: string;
  amount?: number;
  status?: string;
  metadata?: any;
}

interface JobHistoryProps {
  jobId: string;
}

export default function JobHistory({ jobId }: JobHistoryProps) {
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [jobId]);

  async function fetchHistory() {
    setLoading(true);
    
    const [
      timesheetsRes,
      expensesRes,
      invoicesRes,
      jobAssetsRes,
      issuesRes,
      inventoryRes,
    ] = await Promise.all([
      supabase.from('timesheets').select('*, profiles(full_name)').eq('job_id', jobId),
      supabase.from('expenses').select('*').eq('job_id', jobId),
      supabase.from('invoices').select('*').eq('job_id', jobId),
      supabase.from('job_assets').select('*, assets(name)').eq('job_id', jobId),
      supabase.from('issues').select('*').eq('job_id', jobId),
      supabase.from('inventory_movements').select('*, items(name)').eq('job_id', jobId),
    ]);

    const allEvents: HistoryEvent[] = [];

    // Timesheets
    (timesheetsRes.data || []).forEach(ts => {
      allEvents.push({
        id: `ts-${ts.id}`,
        type: 'timesheet',
        date: ts.date,
        title: `Time Entry: ${ts.hours}h`,
        description: `${(ts as any).profiles?.full_name || 'Unknown'} - ${ts.description || 'No description'}`,
        amount: ts.hours,
        metadata: ts,
      });
    });

    // Expenses
    (expensesRes.data || []).forEach(exp => {
      allEvents.push({
        id: `exp-${exp.id}`,
        type: 'expense',
        date: exp.date,
        title: `Expense: $${exp.amount}`,
        description: exp.description,
        amount: exp.amount,
        metadata: exp,
      });
    });

    // Invoices
    (invoicesRes.data || []).forEach(inv => {
      allEvents.push({
        id: `inv-${inv.id}`,
        type: 'invoice',
        date: inv.issue_date,
        title: `Invoice: ${inv.invoice_number}`,
        description: `Total: $${inv.total}`,
        amount: inv.total,
        status: inv.status,
        metadata: inv,
      });
    });

    // Job Assets
    (jobAssetsRes.data || []).forEach(ja => {
      allEvents.push({
        id: `ja-${ja.id}`,
        type: 'job_asset',
        date: ja.rental_start_date,
        title: `Asset Added: ${(ja as any).assets?.name || 'Asset'}`,
        description: `Rate: $${ja.rental_rate}/${ja.billing_frequency}`,
        amount: ja.rental_rate,
        status: ja.is_active ? 'active' : 'ended',
        metadata: ja,
      });
      if (ja.rental_end_date) {
        allEvents.push({
          id: `ja-end-${ja.id}`,
          type: 'job_asset',
          date: ja.rental_end_date,
          title: `Asset Ended: ${(ja as any).assets?.name || 'Asset'}`,
          description: 'Rental period ended',
          status: 'ended',
          metadata: ja,
        });
      }
    });

    // Issues
    (issuesRes.data || []).forEach(issue => {
      allEvents.push({
        id: `issue-${issue.id}`,
        type: 'issue',
        date: issue.created_at.split('T')[0],
        title: `Issue: ${issue.title}`,
        description: issue.description || '',
        status: issue.status,
        metadata: issue,
      });
      if (issue.resolved_at) {
        allEvents.push({
          id: `issue-resolved-${issue.id}`,
          type: 'issue',
          date: issue.resolved_at.split('T')[0],
          title: `Issue Resolved: ${issue.title}`,
          description: 'Issue marked as resolved',
          status: 'resolved',
          metadata: issue,
        });
      }
    });

    // Inventory movements
    (inventoryRes.data || []).forEach(mov => {
      allEvents.push({
        id: `inv-mov-${mov.id}`,
        type: 'inventory',
        date: mov.created_at.split('T')[0],
        title: `Inventory: ${(mov as any).items?.name || 'Item'}`,
        description: `${mov.movement_type}: ${mov.quantity} units`,
        amount: mov.quantity,
        metadata: mov,
      });
    });

    // Sort by date descending
    allEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    setEvents(allEvents);
    setLoading(false);
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'timesheet': return <Clock className="h-4 w-4" />;
      case 'expense': return <DollarSign className="h-4 w-4" />;
      case 'invoice': return <FileText className="h-4 w-4" />;
      case 'job_asset': return <Package className="h-4 w-4" />;
      case 'issue': return <AlertCircle className="h-4 w-4" />;
      case 'inventory': return <Wrench className="h-4 w-4" />;
      default: return <History className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'timesheet': return 'bg-blue-100 text-blue-700';
      case 'expense': return 'bg-amber-100 text-amber-700';
      case 'invoice': return 'bg-green-100 text-green-700';
      case 'job_asset': return 'bg-purple-100 text-purple-700';
      case 'issue': return 'bg-red-100 text-red-700';
      case 'inventory': return 'bg-cyan-100 text-cyan-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusBadge = (type: string, status?: string) => {
    if (!status) return null;
    
    let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary';
    if (status === 'paid' || status === 'resolved' || status === 'closed') variant = 'default';
    if (status === 'overdue' || status === 'open') variant = 'destructive';
    
    return <Badge variant={variant} className="text-xs">{status}</Badge>;
  };

  if (loading) {
    return <div className="text-muted-foreground p-4">Loading history...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Job History ({events.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No history yet</p>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {events.map(event => (
              <div key={event.id} className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50">
                <div className={`p-2 rounded-full ${getTypeColor(event.type)} shrink-0`}>
                  {getIcon(event.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{event.title}</span>
                    {getStatusBadge(event.type, event.status)}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{event.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(event.date).toLocaleDateString('en-AU', { 
                      day: 'numeric', month: 'short', year: 'numeric' 
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}