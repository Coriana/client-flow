import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
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
  Menu,
  X,
  LogOut,
  Store,
  Shield,
  Building2,
  Key,
  HelpCircle,
  History,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionContext';
import { useBranding } from '@/contexts/BrandingContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MyProfileDialog from '@/components/MyProfileDialog';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  resource?: string; // Resource to check for visibility
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Clients', href: '/clients', icon: Users, resource: 'clients' },
  { name: 'Jobs', href: '/jobs', icon: Briefcase, resource: 'jobs' },
  { name: 'Invoices', href: '/invoices', icon: FileText, resource: 'invoices' },
  { name: 'Payments', href: '/payments', icon: CreditCard, resource: 'payments' },
  { name: 'Banking', href: '/banking', icon: Building2, resource: 'banking' },
  { name: 'Vendors', href: '/vendors', icon: Store, resource: 'vendors' },
  { name: 'Inventory', href: '/inventory', icon: Package, resource: 'inventory' },
  { name: 'Assets', href: '/assets', icon: HardDrive, resource: 'assets' },
  { name: 'Issues', href: '/issues', icon: AlertCircle, resource: 'issues' },
  { name: 'Knowledge Base', href: '/knowledge-base', icon: FileText, resource: 'kb' },
  { name: 'Locations', href: '/locations', icon: Building2, resource: 'locations' },
  { name: 'Reports', href: '/reports', icon: BarChart3, resource: 'reports' },
  { name: 'Team', href: '/team', icon: Users, resource: 'team' },
  { name: 'Roles', href: '/roles', icon: Shield, resource: 'settings' },
  { name: 'API Keys', href: '/api-keys', icon: Key, resource: 'settings' },
  { name: 'Activity Log', href: '/activity-log', icon: History, resource: 'reports' },
  { name: 'Settings', href: '/settings', icon: Settings, resource: 'settings' },
  { name: 'Help & Docs', href: '/docs', icon: HelpCircle },
];

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { canRead, role, loading: permissionsLoading } = usePermissions();
  const { branding } = useBranding();

  // Filter navigation based on permissions
  const visibleNavigation = navigation.filter(item => {
    if (!item.resource) return true; // Always show items without resource check
    return canRead(item.resource);
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-foreground/20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-200 ease-in-out lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-16 items-center justify-between px-6 border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-2">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.appName} className="h-8 max-w-[160px] object-contain" />
            ) : (
              <span className="text-xl font-semibold text-sidebar-foreground">{branding.appName}</span>
            )}
          </Link>
          <button 
            className="lg:hidden text-sidebar-foreground"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNavigation.map((item) => {
            const isActive = location.pathname === item.href || 
              (item.href !== '/' && location.pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
              <span className="text-sm font-medium text-sidebar-accent-foreground">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user?.email}
              </p>
              {role && (
                <Badge variant="secondary" className="text-xs capitalize">
                  {role.name}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => setProfileOpen(true)}
            >
              <User className="h-4 w-4 mr-2" />
              Profile
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background px-4 lg:hidden">
          <button 
            className="text-foreground"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.appName} className="h-6 max-w-[120px] object-contain" />
          ) : (
            <span className="text-lg font-semibold">{branding.appName}</span>
          )}
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>

      <MyProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}
