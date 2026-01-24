import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Briefcase, Clock, FileText, AlertTriangle, Receipt } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";

interface TeamMemberActivityProps {
  memberId: string;
}

const TeamMemberActivity = ({ memberId }: TeamMemberActivityProps) => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      setLoading(true);
      try {
        // Fetch job assignments
        const { data: jobAssignments } = await supabase
          .from('job_assignments')
          .select('job_id, jobs(id, name, job_number, status, client_id, clients(name))')
          .eq('user_id', memberId);
        
        setJobs(jobAssignments?.map(ja => ja.jobs).filter(Boolean) || []);

        // Fetch timesheets
        const { data: timesheetData } = await supabase
          .from('timesheets')
          .select('*, jobs(name, job_number)')
          .eq('user_id', memberId)
          .order('date', { ascending: false })
          .limit(20);
        
        setTimesheets(timesheetData || []);

        // Fetch invoices created by user
        const { data: invoiceData } = await supabase
          .from('invoices')
          .select('*, clients(name)')
          .eq('created_by', memberId)
          .order('created_at', { ascending: false })
          .limit(20);
        
        setInvoices(invoiceData || []);

        // Fetch issues assigned to user
        const { data: issueData } = await supabase
          .from('issues')
          .select('*, clients(name)')
          .eq('assignee_id', memberId)
          .order('created_at', { ascending: false })
          .limit(20);
        
        setIssues(issueData || []);

        // Fetch expenses
        const { data: expenseData } = await supabase
          .from('expenses')
          .select('*, jobs(name, job_number), vendors(name)')
          .eq('user_id', memberId)
          .order('date', { ascending: false })
          .limit(20);
        
        setExpenses(expenseData || []);
      } catch (error) {
        console.error('Error fetching activity:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, [memberId]);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': case 'open': return 'default';
      case 'completed': case 'paid': case 'resolved': return 'secondary';
      case 'on_hold': case 'pending': return 'outline';
      case 'overdue': return 'destructive';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="jobs" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="jobs" className="flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              Jobs ({jobs.length})
            </TabsTrigger>
            <TabsTrigger value="time" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Time ({timesheets.length})
            </TabsTrigger>
            <TabsTrigger value="invoices" className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Invoices ({invoices.length})
            </TabsTrigger>
            <TabsTrigger value="issues" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Issues ({issues.length})
            </TabsTrigger>
            <TabsTrigger value="expenses" className="flex items-center gap-1">
              <Receipt className="h-3 w-3" />
              Expenses ({expenses.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="jobs">
            <ScrollArea className="h-[300px]">
              {jobs.length === 0 ? (
                <p className="text-muted-foreground text-sm">No jobs assigned</p>
              ) : (
                <div className="space-y-2">
                  {jobs.map((job: any) => (
                    <Link key={job.id} to={`/jobs/${job.id}`} className="block">
                      <div className="p-3 border rounded-lg hover:bg-accent transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{job.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {job.job_number} • {job.clients?.name}
                            </div>
                          </div>
                          <Badge variant={getStatusBadgeVariant(job.status)} className="capitalize">
                            {job.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="time">
            <ScrollArea className="h-[300px]">
              {timesheets.length === 0 ? (
                <p className="text-muted-foreground text-sm">No time entries</p>
              ) : (
                <div className="space-y-2">
                  {timesheets.map((entry: any) => (
                    <div key={entry.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{entry.jobs?.name || 'No job'}</div>
                          <div className="text-sm text-muted-foreground">
                            {entry.description || 'No description'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{entry.hours}h</div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(entry.date), 'PP')}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="invoices">
            <ScrollArea className="h-[300px]">
              {invoices.length === 0 ? (
                <p className="text-muted-foreground text-sm">No invoices created</p>
              ) : (
                <div className="space-y-2">
                  {invoices.map((invoice: any) => (
                    <Link key={invoice.id} to={`/invoices/${invoice.id}`} className="block">
                      <div className="p-3 border rounded-lg hover:bg-accent transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{invoice.invoice_number}</div>
                            <div className="text-sm text-muted-foreground">
                              {invoice.clients?.name}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">${invoice.total?.toFixed(2)}</div>
                            <Badge variant={getStatusBadgeVariant(invoice.status)} className="capitalize">
                              {invoice.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="issues">
            <ScrollArea className="h-[300px]">
              {issues.length === 0 ? (
                <p className="text-muted-foreground text-sm">No issues assigned</p>
              ) : (
                <div className="space-y-2">
                  {issues.map((issue: any) => (
                    <Link key={issue.id} to={`/issues/${issue.id}`} className="block">
                      <div className="p-3 border rounded-lg hover:bg-accent transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{issue.title}</div>
                            <div className="text-sm text-muted-foreground">
                              {issue.clients?.name || 'No client'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={issue.severity === 'critical' ? 'destructive' : 'outline'} className="capitalize">
                              {issue.severity}
                            </Badge>
                            <Badge variant={getStatusBadgeVariant(issue.status)} className="capitalize">
                              {issue.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="expenses">
            <ScrollArea className="h-[300px]">
              {expenses.length === 0 ? (
                <p className="text-muted-foreground text-sm">No expenses recorded</p>
              ) : (
                <div className="space-y-2">
                  {expenses.map((expense: any) => (
                    <div key={expense.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{expense.description}</div>
                          <div className="text-sm text-muted-foreground">
                            {expense.jobs?.name || expense.vendors?.name || expense.category}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">${expense.amount?.toFixed(2)}</div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(expense.date), 'PP')}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default TeamMemberActivity;
