import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useSetupComplete } from '@/hooks/useSetupComplete';
import { useBranding } from '@/contexts/BrandingContext';
import { SetupWizard } from '@/components/setup/SetupWizard';
import { formatDateOnly } from '@/lib/dates';
import { formatDistanceToNow } from 'date-fns';
import { 
  DollarSign, 
  FileText, 
  AlertCircle, 
  Briefcase, 
  Plus,
  TrendingUp,
  Clock,
  RefreshCw,
  Package,
  AlertTriangle,
  Building2,
  Wallet,
  Users,
  Filter
} from 'lucide-react';

interface DashboardStats {
  outstandingInvoices: number;
  outstandingAmount: number;
  cashCollectedThisMonth: number;
  openIssues: number;
  activeJobs: number;
  lowStockItems: number;
  totalBankBalance: number;
}

interface BankAccount {
  id: string;
  name: string;
  bank_name: string | null;
  current_balance: number;
  is_default: boolean;
}

interface OutstandingInvoice {
  id: string;
  invoice_number: string;
  total: number;
  amount_paid: number;
  due_date: string;
  status: string;
  clients?: { name: string } | null;
}

interface OpenIssue {
  id: string;
  title: string;
  severity: string;
  status: string;
  created_at: string;
  clients?: { name: string } | null;
}

interface LowStockItem {
  id: string;
  name: string;
  sku: string;
  current_stock: number;
  reorder_level: number;
}

interface ActivityLogEntry {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  created_at: string;
  user_name?: string;
}

interface DashboardData {
  stats: DashboardStats;
  bankAccounts: BankAccount[];
  outstandingInvoices: OutstandingInvoice[];
  openIssues: OpenIssue[];
  lowStockItems: LowStockItem[];
  topJobs: any[];
  activityItems: ActivityLogEntry[];
}

const DEFAULT_STATS: DashboardStats = {
  outstandingInvoices: 0,
  outstandingAmount: 0,
  cashCollectedThisMonth: 0,
  openIssues: 0,
  activeJobs: 0,
  lowStockItems: 0,
  totalBankBalance: 0,
};

const ENTITY_TYPES = [
  { value: 'all', label: 'All Activity' },
  { value: 'clients', label: 'Clients' },
  { value: 'jobs', label: 'Jobs' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'payments', label: 'Payments' },
  { value: 'issues', label: 'Issues' },
  { value: 'assets', label: 'Assets' },
  { value: 'items', label: 'Inventory' },
];

async function fetchDashboardData(): Promise<DashboardData> {
  // Fetch outstanding invoices with client info (display list — capped at 10)
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, total, amount_paid, status, due_date, clients(name)')
    .in('status', ['sent', 'partially_paid', 'overdue'])
    .order('due_date', { ascending: true })
    .limit(10);

  // Fetch the accurate outstanding invoice count (unlimited, for the stat card)
  const { count: outstandingInvoiceCount } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .in('status', ['sent', 'partially_paid', 'overdue']);

  // Fetch all outstanding invoices (narrow projection, unlimited) to compute the accurate total
  const { data: allOutstandingInvoices } = await supabase
    .from('invoices')
    .select('total, amount_paid')
    .in('status', ['sent', 'partially_paid', 'overdue']);

  const outstandingAmount = allOutstandingInvoices?.reduce((sum, inv) => sum + (inv.total - inv.amount_paid), 0) || 0;

  // Fetch cash collected this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: payments } = await supabase
    .from('payments')
    .select('amount')
    .gte('date', formatDateOnly(startOfMonth));

  const cashCollected = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;

  // Fetch open issues with client info (display list — capped at 10)
  const { data: issues } = await supabase
    .from('issues')
    .select('id, title, severity, status, created_at, clients(name)')
    .in('status', ['open', 'in_progress'])
    .order('severity', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(10);

  // Fetch the accurate open issues count (unlimited, for the stat card)
  const { count: openIssuesCount } = await supabase
    .from('issues')
    .select('*', { count: 'exact', head: true })
    .in('status', ['open', 'in_progress']);

  // Fetch active jobs count
  const { count: jobCount } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  // Fetch low stock items
  const { data: items } = await supabase
    .from('items')
    .select('id, name, sku, current_stock, reorder_level')
    .eq('is_active', true);

  const lowStock = (items || []).filter(item =>
    (item.current_stock || 0) <= (item.reorder_level || 0) && (item.reorder_level || 0) > 0
  );

  // Fetch top 5 jobs by revenue
  const { data: jobs } = await supabase
    .from('jobs')
    .select(`
      id,
      name,
      job_number,
      invoices (total, amount_paid)
    `)
    .eq('status', 'active')
    .limit(5);

  const jobsWithRevenue = jobs?.map(job => ({
    ...job,
    revenue: job.invoices?.reduce((sum: number, inv: any) => sum + inv.amount_paid, 0) || 0,
  })).sort((a, b) => b.revenue - a.revenue) || [];

  // Fetch bank accounts
  const { data: bankAccountsData } = await supabase
    .from('bank_accounts')
    .select('id, name, bank_name, current_balance, is_default')
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('name');

  const totalBankBalance = (bankAccountsData || []).reduce(
    (sum, acc) => sum + Number(acc.current_balance || 0), 0
  );

  // Fetch recent activity from activity_log
  const { data: activityLogData } = await supabase
    .from('activity_log')
    .select('id, user_id, action, entity_type, entity_id, entity_name, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  // Fetch user profiles for activity log entries
  const userIds = [...new Set((activityLogData || []).filter(a => a.user_id).map(a => a.user_id!))];
  let profilesMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);

    profiles?.forEach(p => {
      profilesMap[p.id] = p.full_name || p.email || 'Unknown';
    });
  }

  const enrichedActivity = (activityLogData || []).map(entry => ({
    ...entry,
    user_name: entry.user_id ? profilesMap[entry.user_id] || 'System' : 'System',
  }));

  return {
    stats: {
      outstandingInvoices: outstandingInvoiceCount || 0,
      outstandingAmount,
      cashCollectedThisMonth: cashCollected,
      openIssues: openIssuesCount || 0,
      activeJobs: jobCount || 0,
      lowStockItems: lowStock.length,
      totalBankBalance,
    },
    bankAccounts: bankAccountsData || [],
    outstandingInvoices: invoices || [],
    openIssues: issues || [],
    lowStockItems: lowStock,
    topJobs: jobsWithRevenue,
    activityItems: enrichedActivity,
  };
}

export default function Dashboard() {
  const { toast } = useToast();
  const { branding, formatCurrency } = useBranding();
  const { isComplete: setupComplete, isLoading: setupLoading, refetch: refetchSetup } = useSetupComplete();
  const [activityFilter, setActivityFilter] = useState('all');
  const [generatingInvoices, setGeneratingInvoices] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardData,
  });

  const stats = data?.stats ?? DEFAULT_STATS;
  const bankAccounts = data?.bankAccounts ?? [];
  const outstandingInvoices = data?.outstandingInvoices ?? [];
  const openIssues = data?.openIssues ?? [];
  const lowStockItems = data?.lowStockItems ?? [];
  const topJobs = data?.topJobs ?? [];
  const activityItems = data?.activityItems ?? [];
  const loading = isLoading;

  async function handleGenerateJobInvoices() {
    setGeneratingInvoices(true);
    try {
      const { data: invokeData, error } = await supabase.functions.invoke('generate-job-invoices');
      if (error) throw error;
      toast({
        title: 'Job Invoices',
        description: invokeData.message,
      });
      refetch();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setGeneratingInvoices(false);
    }
  }

  const severityColors: Record<string, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-blue-500',
  };

  const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    overdue: 'destructive',
    sent: 'secondary',
    partially_paid: 'outline',
  };

  const getActivityIcon = (entityType: string) => {
    const iconClass = "h-4 w-4";
    switch (entityType) {
      case 'invoices': return <FileText className={iconClass} />;
      case 'payments': return <DollarSign className={iconClass} />;
      case 'jobs': return <Briefcase className={iconClass} />;
      case 'issues': return <AlertCircle className={iconClass} />;
      case 'clients': return <Users className={iconClass} />;
      case 'assets': return <Package className={iconClass} />;
      case 'items': return <Package className={iconClass} />;
      default: return <Clock className={iconClass} />;
    }
  };

  const getIconBgColor = (entityType: string) => {
    switch (entityType) {
      case 'invoices': return 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400';
      case 'payments': return 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400';
      case 'jobs': return 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400';
      case 'issues': return 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400';
      case 'clients': return 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-400';
      case 'assets': return 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900 dark:text-cyan-400';
      case 'items': return 'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400';
      default: return 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400';
    }
  };

  const getEntityLink = (entityType: string, entityId: string | null) => {
    if (!entityId) return '#';
    switch (entityType) {
      case 'invoices': return `/invoices/${entityId}`;
      case 'payments': return `/payments`;
      case 'jobs': return `/jobs/${entityId}`;
      case 'issues': return `/issues/${entityId}`;
      case 'clients': return `/clients/${entityId}`;
      case 'assets': return `/assets/${entityId}`;
      case 'items': return `/inventory/${entityId}`;
      case 'vendors': return `/vendors/${entityId}`;
      default: return '#';
    }
  };

  const filteredActivityItems = activityItems.filter(item => 
    activityFilter === 'all' || item.entity_type === activityFilter
  );

  return (
    <div className="space-y-8">
      {/* Setup Wizard for new users */}
      {!setupLoading && !setupComplete && (
        <SetupWizard onComplete={refetchSetup} />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Overview of {branding.companyName}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/jobs/new">
            <Plus className="h-4 w-4 mr-2" />
            New Job
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/invoices/new">
            <FileText className="h-4 w-4 mr-2" />
            New Invoice
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/issues/new">
            <AlertCircle className="h-4 w-4 mr-2" />
            Log Issue
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/inventory">
            <Package className="h-4 w-4 mr-2" />
            Inventory
          </Link>
        </Button>
        <Button 
          variant="outline" 
          onClick={handleGenerateJobInvoices}
          disabled={generatingInvoices}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${generatingInvoices ? 'animate-spin' : ''}`} />
          Generate Job Invoices
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bank Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.totalBankBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(stats.totalBankBalance)}
            </div>
            <p className="text-xs text-muted-foreground">
              {bankAccounts.length} account{bankAccounts.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Invoices</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.outstandingAmount)}</div>
            <p className="text-xs text-muted-foreground">
              {stats.outstandingInvoices} invoice{stats.outstandingInvoices !== 1 ? 's' : ''} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cash This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.cashCollectedThisMonth)}</div>
            <p className="text-xs text-muted-foreground">
              Collected payments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeJobs}</div>
            <p className="text-xs text-muted-foreground">
              Currently in progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Issues</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.openIssues}</div>
            <p className="text-xs text-muted-foreground">
              Require attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bank Accounts Summary */}
      {bankAccounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Bank Accounts
            </CardTitle>
            <CardDescription>Current balances across all accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {bankAccounts.map((account) => (
                <Link
                  key={account.id}
                  to={`/banking/${account.id}`}
                  className="block p-4 rounded-lg border hover:bg-muted transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{account.name}</p>
                      {account.bank_name && (
                        <p className="text-sm text-muted-foreground">{account.bank_name}</p>
                      )}
                    </div>
                    {account.is_default && (
                      <Badge variant="secondary" className="text-xs">Default</Badge>
                    )}
                  </div>
                  <p className={`text-xl font-bold mt-2 ${Number(account.current_balance) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(Number(account.current_balance))}
                  </p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lists Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Outstanding Invoices */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Outstanding Invoices
            </CardTitle>
            <CardDescription>Invoices awaiting payment</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : outstandingInvoices.length > 0 ? (
              <div className="space-y-3">
                {outstandingInvoices.map((inv) => (
                  <Link
                    key={inv.id}
                    to={`/invoices/${inv.id}`}
                    className="block p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{inv.invoice_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {inv.clients?.name || 'Unknown Client'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Due: {new Date(inv.due_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(inv.total - inv.amount_paid)}</p>
                        <Badge variant={statusColors[inv.status] || 'secondary'}>
                          {inv.status}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">No outstanding invoices</p>
            )}
          </CardContent>
        </Card>

        {/* Open Issues */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Open Issues
            </CardTitle>
            <CardDescription>Issues requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : openIssues.length > 0 ? (
              <div className="space-y-3">
                {openIssues.map((issue) => (
                  <Link
                    key={issue.id}
                    to={`/issues/${issue.id}`}
                    className="block p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-2 ${severityColors[issue.severity] || 'bg-gray-400'}`} />
                      <div className="flex-1">
                        <p className="font-medium">{issue.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {issue.clients?.name || 'No client'}
                        </p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {issue.severity}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {issue.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">No open issues</p>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Low Stock Items
              {lowStockItems.length > 0 && (
                <Badge variant="destructive">{lowStockItems.length}</Badge>
              )}
            </CardTitle>
            <CardDescription>Items below reorder level</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : lowStockItems.length > 0 ? (
              <div className="space-y-3">
                {lowStockItems.map((item) => (
                  <Link
                    key={item.id}
                    to="/inventory"
                    className="block p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">{item.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-medium ${item.current_stock <= 0 ? 'text-red-600' : 'text-amber-600'}`}>
                          {item.current_stock} in stock
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Reorder at: {item.reorder_level}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">All items above reorder level</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Jobs and Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Jobs by Revenue</CardTitle>
            <CardDescription>Your best performing active jobs</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : topJobs.length > 0 ? (
              <div className="space-y-4">
                {topJobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between">
                    <div>
                      <Link 
                        to={`/jobs/${job.id}`}
                        className="font-medium hover:underline"
                      >
                        {job.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">{job.job_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(job.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No active jobs yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest updates across your business</CardDescription>
            </div>
            <Select value={activityFilter} onValueChange={setActivityFilter}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : filteredActivityItems.length > 0 ? (
              <div className="space-y-3">
                {filteredActivityItems.slice(0, 8).map((item) => (
                  <Link
                    key={item.id}
                    to={getEntityLink(item.entity_type, item.entity_id)}
                    className="flex items-start gap-3 p-2 -mx-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className={`p-2 rounded-full ${getIconBgColor(item.entity_type)}`}>
                      {getActivityIcon(item.entity_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium capitalize">{item.action}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {item.entity_name || item.entity_type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.user_name} • {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No recent activity</p>
                <p className="text-xs text-muted-foreground">
                  Get started by creating your first client
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}