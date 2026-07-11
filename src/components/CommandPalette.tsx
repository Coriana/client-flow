import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  FileText,
  CreditCard,
  Package,
  HardDrive,
  AlertCircle,
  BarChart3,
  Settings,
  Store,
  Shield,
  Building2,
  Key,
  HelpCircle,
  History,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { usePermissions } from '@/contexts/PermissionContext';
import { supabase } from '@/integrations/supabase/client';

// Returns the platform-appropriate shortcut label for the Search button hint
// (⌘K on Mac, Ctrl K everywhere else).
export function getCommandShortcutLabel(): string {
  if (typeof navigator === 'undefined') return 'Ctrl K';
  const platform = navigator.platform || navigator.userAgent || '';
  return /Mac|iPhone|iPad|iPod/i.test(platform) ? '⌘K' : 'Ctrl K';
}

interface NavPage {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  resource?: string;
}

// Mirrors AppLayout's flat list of destinations (same icons, same resources)
// so the "Pages" group matches the sidebar exactly.
const pages: NavPage[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Clients', href: '/clients', icon: Users, resource: 'clients' },
  { name: 'Jobs', href: '/jobs', icon: Briefcase, resource: 'jobs' },
  { name: 'Issues', href: '/issues', icon: AlertCircle, resource: 'issues' },
  { name: 'Invoices', href: '/invoices', icon: FileText, resource: 'invoices' },
  { name: 'Payments', href: '/payments', icon: CreditCard, resource: 'payments' },
  { name: 'Banking', href: '/banking', icon: Building2, resource: 'banking' },
  { name: 'Vendors', href: '/vendors', icon: Store, resource: 'vendors' },
  { name: 'Inventory', href: '/inventory', icon: Package, resource: 'inventory' },
  { name: 'Assets', href: '/assets', icon: HardDrive, resource: 'assets' },
  { name: 'Locations', href: '/locations', icon: Building2, resource: 'locations' },
  { name: 'Knowledge Base', href: '/knowledge-base', icon: FileText, resource: 'kb' },
  { name: 'Reports', href: '/reports', icon: BarChart3, resource: 'reports' },
  { name: 'Activity Log', href: '/activity-log', icon: History, resource: 'reports' },
  { name: 'Team', href: '/team', icon: Users, resource: 'team' },
  { name: 'Roles', href: '/roles', icon: Shield, resource: 'settings' },
  { name: 'API Keys', href: '/api-keys', icon: Key, resource: 'settings' },
  { name: 'Settings', href: '/settings', icon: Settings, resource: 'settings' },
  { name: 'Help & Docs', href: '/docs', icon: HelpCircle },
];

interface QuickAction {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  resource: string;
}

const quickActions: QuickAction[] = [
  { name: 'New Client', href: '/clients/new', icon: Users, resource: 'clients' },
  { name: 'New Job', href: '/jobs/new', icon: Briefcase, resource: 'jobs' },
  { name: 'New Invoice', href: '/invoices/new', icon: FileText, resource: 'invoices' },
  { name: 'Log Issue', href: '/issues/new', icon: AlertCircle, resource: 'issues' },
];

interface ClientHit {
  id: string;
  name: string;
  trading_name: string | null;
}
interface JobHit {
  id: string;
  name: string;
  job_number: string;
}
interface InvoiceHit {
  id: string;
  invoice_number: string;
  clients: { name: string } | null;
}
interface VendorHit {
  id: string;
  name: string;
}
interface ItemHit {
  id: string;
  name: string;
  sku: string;
}
interface AssetHit {
  id: string;
  name: string;
  asset_tag: string;
}
interface IssueHit {
  id: string;
  title: string;
}
interface KbArticleHit {
  id: string;
  title: string;
}
interface LocationHit {
  id: string;
  name: string;
}
interface BankAccountHit {
  id: string;
  name: string;
}
interface TeamHit {
  id: string;
  full_name: string | null;
  email: string;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { canRead, canWrite } = usePermissions();
  const [search, setSearch] = useState('');

  // Global Ctrl/Cmd+K toggle.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  // Reset the query each time the palette closes so it reopens fresh.
  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const runCommand = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  const canReadClients = canRead('clients');
  const canReadJobs = canRead('jobs');
  const canReadInvoices = canRead('invoices');
  const canReadVendors = canRead('vendors');
  const canReadInventory = canRead('inventory');
  const canReadAssets = canRead('assets');
  const canReadIssues = canRead('issues');
  const canReadKb = canRead('kb');
  const canReadLocations = canRead('locations');
  const canReadBanking = canRead('banking');
  const canReadTeam = canRead('team');

  const { data: clients = [] } = useQuery({
    queryKey: ['command-palette', 'clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, trading_name')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as ClientHit[];
    },
    enabled: open && canReadClients,
    staleTime: 60_000,
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['command-palette', 'jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, name, job_number')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as JobHit[];
    },
    enabled: open && canReadJobs,
    staleTime: 60_000,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['command-palette', 'invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, clients(name)')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as InvoiceHit[];
    },
    enabled: open && canReadInvoices,
    staleTime: 60_000,
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['command-palette', 'vendors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as VendorHit[];
    },
    enabled: open && canReadVendors,
    staleTime: 60_000,
  });

  const { data: items = [] } = useQuery({
    queryKey: ['command-palette', 'items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('id, name, sku')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as ItemHit[];
    },
    enabled: open && canReadInventory,
    staleTime: 60_000,
  });

  const { data: assets = [] } = useQuery({
    queryKey: ['command-palette', 'assets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assets')
        .select('id, name, asset_tag')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as AssetHit[];
    },
    enabled: open && canReadAssets,
    staleTime: 60_000,
  });

  const { data: issues = [] } = useQuery({
    queryKey: ['command-palette', 'issues'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('issues')
        .select('id, title')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as IssueHit[];
    },
    enabled: open && canReadIssues,
    staleTime: 60_000,
  });

  const { data: kbArticles = [] } = useQuery({
    queryKey: ['command-palette', 'kb_articles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kb_articles')
        .select('id, title')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as KbArticleHit[];
    },
    enabled: open && canReadKb,
    staleTime: 60_000,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['command-palette', 'locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as LocationHit[];
    },
    enabled: open && canReadLocations,
    staleTime: 60_000,
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['command-palette', 'bank_accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('id, name')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as BankAccountHit[];
    },
    enabled: open && canReadBanking,
    staleTime: 60_000,
  });

  const { data: team = [] } = useQuery({
    queryKey: ['command-palette', 'profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as TeamHit[];
    },
    enabled: open && canReadTeam,
    staleTime: 60_000,
  });

  const hasQuery = search.trim().length > 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <DialogTitle className="sr-only">Command Palette</DialogTitle>
      <DialogDescription className="sr-only">
        Search pages and records, or run a quick action.
      </DialogDescription>
      <CommandInput
        placeholder="Type a command or search…"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Quick Actions">
          {quickActions
            .filter(action => canWrite(action.resource))
            .map(action => (
              <CommandItem
                key={action.href}
                value={`action-${action.name}`}
                onSelect={() => runCommand(() => navigate(action.href))}
              >
                <action.icon className="mr-2 h-4 w-4" />
                {action.name}
              </CommandItem>
            ))}
        </CommandGroup>

        <CommandGroup heading="Pages">
          {pages
            .filter(page => !page.resource || canRead(page.resource))
            .map(page => (
              <CommandItem
                key={page.href}
                value={`page-${page.name}`}
                onSelect={() => runCommand(() => navigate(page.href))}
              >
                <page.icon className="mr-2 h-4 w-4" />
                {page.name}
              </CommandItem>
            ))}
        </CommandGroup>

        {hasQuery && canReadClients && clients.length > 0 && (
          <CommandGroup heading="Clients">
            {clients.map(client => (
              <CommandItem
                key={client.id}
                value={`client-${client.id}-${client.name}`}
                onSelect={() => runCommand(() => navigate(`/clients/${client.id}`))}
              >
                <Users className="mr-2 h-4 w-4" />
                <span>{client.name}</span>
                {client.trading_name && (
                  <span className="ml-2 text-xs text-muted-foreground">{client.trading_name}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {hasQuery && canReadJobs && jobs.length > 0 && (
          <CommandGroup heading="Jobs">
            {jobs.map(job => (
              <CommandItem
                key={job.id}
                value={`job-${job.id}-${job.name}-${job.job_number}`}
                onSelect={() => runCommand(() => navigate(`/jobs/${job.id}`))}
              >
                <Briefcase className="mr-2 h-4 w-4" />
                <span>{job.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{job.job_number}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {hasQuery && canReadInvoices && invoices.length > 0 && (
          <CommandGroup heading="Invoices">
            {invoices.map(invoice => (
              <CommandItem
                key={invoice.id}
                value={`invoice-${invoice.id}-${invoice.invoice_number}-${invoice.clients?.name ?? ''}`}
                onSelect={() => runCommand(() => navigate(`/invoices/${invoice.id}`))}
              >
                <FileText className="mr-2 h-4 w-4" />
                <span>{invoice.invoice_number}</span>
                {invoice.clients?.name && (
                  <span className="ml-2 text-xs text-muted-foreground">{invoice.clients.name}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {hasQuery && canReadVendors && vendors.length > 0 && (
          <CommandGroup heading="Vendors">
            {vendors.map(vendor => (
              <CommandItem
                key={vendor.id}
                value={`vendor-${vendor.id}-${vendor.name}`}
                onSelect={() => runCommand(() => navigate(`/vendors/${vendor.id}`))}
              >
                <Store className="mr-2 h-4 w-4" />
                <span>{vendor.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {hasQuery && canReadInventory && items.length > 0 && (
          <CommandGroup heading="Inventory">
            {items.map(item => (
              <CommandItem
                key={item.id}
                value={`item-${item.id}-${item.name}-${item.sku}`}
                onSelect={() => runCommand(() => navigate(`/inventory/${item.id}`))}
              >
                <Package className="mr-2 h-4 w-4" />
                <span>{item.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{item.sku}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {hasQuery && canReadAssets && assets.length > 0 && (
          <CommandGroup heading="Assets">
            {assets.map(asset => (
              <CommandItem
                key={asset.id}
                value={`asset-${asset.id}-${asset.name}-${asset.asset_tag}`}
                onSelect={() => runCommand(() => navigate(`/assets/${asset.id}`))}
              >
                <HardDrive className="mr-2 h-4 w-4" />
                <span>{asset.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{asset.asset_tag}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {hasQuery && canReadIssues && issues.length > 0 && (
          <CommandGroup heading="Issues">
            {issues.map(issue => (
              <CommandItem
                key={issue.id}
                value={`issue-${issue.id}-${issue.title}`}
                onSelect={() => runCommand(() => navigate(`/issues/${issue.id}`))}
              >
                <AlertCircle className="mr-2 h-4 w-4" />
                <span>{issue.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {hasQuery && canReadKb && kbArticles.length > 0 && (
          <CommandGroup heading="Knowledge Base">
            {kbArticles.map(article => (
              <CommandItem
                key={article.id}
                value={`kb-${article.id}-${article.title}`}
                onSelect={() => runCommand(() => navigate(`/knowledge-base/${article.id}`))}
              >
                <FileText className="mr-2 h-4 w-4" />
                <span>{article.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {hasQuery && canReadLocations && locations.length > 0 && (
          <CommandGroup heading="Locations">
            {locations.map(loc => (
              <CommandItem
                key={loc.id}
                value={`location-${loc.id}-${loc.name}`}
                onSelect={() => runCommand(() => navigate(`/locations/${loc.id}`))}
              >
                <Building2 className="mr-2 h-4 w-4" />
                <span>{loc.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {hasQuery && canReadBanking && bankAccounts.length > 0 && (
          <CommandGroup heading="Bank Accounts">
            {bankAccounts.map(account => (
              <CommandItem
                key={account.id}
                value={`bank-${account.id}-${account.name}`}
                onSelect={() => runCommand(() => navigate(`/banking/${account.id}`))}
              >
                <Building2 className="mr-2 h-4 w-4" />
                <span>{account.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {hasQuery && canReadTeam && team.length > 0 && (
          <CommandGroup heading="Team">
            {team.map(member => (
              <CommandItem
                key={member.id}
                value={`team-${member.id}-${member.full_name ?? ''}-${member.email}`}
                onSelect={() => runCommand(() => navigate(`/team/${member.id}`))}
              >
                <Users className="mr-2 h-4 w-4" />
                <span>{member.full_name || member.email}</span>
                {member.full_name && (
                  <span className="ml-2 text-xs text-muted-foreground">{member.email}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
