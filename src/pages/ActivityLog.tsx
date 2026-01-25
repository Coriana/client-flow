import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, formatDistanceToNow, startOfDay, subDays, isToday, isYesterday } from "date-fns";
import { 
  Users, Briefcase, FileText, DollarSign, AlertCircle, 
  Package, Box, Clock, Receipt, Building2, History,
  Plus, Pencil, Trash2, ShieldAlert, Globe, Monitor, Key,
  BookOpen, Settings, FileSpreadsheet
} from "lucide-react";
import { Link } from "react-router-dom";
import ActivityDetails from "@/components/ActivityDetails";
import { usePermissions } from "@/contexts/PermissionContext";

interface ActivityLogEntry {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  description: string | null;
  old_values: unknown;
  new_values: unknown;
  created_at: string;
  source: string | null;
  api_key_id: string | null;
  user?: { full_name: string | null; email: string | null } | null;
  api_key?: { name: string; key_prefix: string } | null;
}

const ENTITY_TYPES = [
  { value: "all", label: "All Types" },
  { value: "clients", label: "Clients" },
  { value: "jobs", label: "Jobs" },
  { value: "invoices", label: "Invoices" },
  { value: "estimates", label: "Estimates" },
  { value: "payments", label: "Payments" },
  { value: "issues", label: "Issues" },
  { value: "assets", label: "Assets" },
  { value: "items", label: "Inventory" },
  { value: "timesheets", label: "Timesheets" },
  { value: "expenses", label: "Expenses" },
  { value: "purchases", label: "Purchases" },
  { value: "vendors", label: "Vendors" },
  { value: "kb_articles", label: "Knowledge Base" },
  { value: "profiles", label: "Profiles" },
  { value: "company_settings", label: "Settings" },
];

const ACTIONS = [
  { value: "all", label: "All Actions" },
  { value: "created", label: "Created" },
  { value: "updated", label: "Updated" },
  { value: "deleted", label: "Deleted" },
];

const SOURCES = [
  { value: "all", label: "All Sources" },
  { value: "browser", label: "Browser" },
  { value: "api", label: "API" },
];

const DATE_RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

export default function ActivityLog() {
  const { canRead, loading: permissionsLoading } = usePermissions();
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityTypeFilter, setEntityTypeFilter] = useState("all");

  // Check permission for activity_log
  if (!permissionsLoading && !canRead('reports')) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <ShieldAlert className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground">You don't have permission to view the activity log.</p>
      </div>
    );
  }
  const [actionFilter, setActionFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [dateRange, setDateRange] = useState("7");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchActivityLog();
  }, [entityTypeFilter, actionFilter, sourceFilter, dateRange]);

  const fetchActivityLog = async () => {
    setLoading(true);
    try {
      const startDate = subDays(new Date(), parseInt(dateRange));
      
      let query = supabase
        .from("activity_log")
        .select("*")
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false })
        .limit(200);

      if (entityTypeFilter !== "all") {
        query = query.eq("entity_type", entityTypeFilter);
      }
      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }
      if (sourceFilter !== "all") {
        query = query.eq("source", sourceFilter);
      }

      const { data, error } = await query;
      
      if (error) throw error;

      // Fetch user names for the entries
      const userIds = [...new Set((data || []).map(e => e.user_id).filter(Boolean))];
      let userMap: Record<string, { full_name: string | null; email: string | null }> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);
        
        userMap = (profiles || []).reduce((acc, p) => {
          acc[p.id] = { full_name: p.full_name, email: p.email };
          return acc;
        }, {} as Record<string, { full_name: string | null; email: string | null }>);
      }

      // Fetch API key names for API-sourced entries
      const apiKeyIds = [...new Set((data || []).map(e => e.api_key_id).filter(Boolean))];
      let apiKeyMap: Record<string, { name: string; key_prefix: string }> = {};
      
      if (apiKeyIds.length > 0) {
        const { data: apiKeys } = await supabase
          .from("api_keys")
          .select("id, name, key_prefix")
          .in("id", apiKeyIds);
        
        apiKeyMap = (apiKeys || []).reduce((acc, k) => {
          acc[k.id] = { name: k.name, key_prefix: k.key_prefix };
          return acc;
        }, {} as Record<string, { name: string; key_prefix: string }>);
      }

      const entriesWithUsers = (data || []).map(entry => ({
        ...entry,
        user: entry.user_id ? userMap[entry.user_id] : null,
        api_key: entry.api_key_id ? apiKeyMap[entry.api_key_id] : null
      }));

      setEntries(entriesWithUsers);
    } catch (error) {
      console.error("Error fetching activity log:", error);
    } finally {
      setLoading(false);
    }
  };

  const getEntityIcon = (entityType: string) => {
    const icons: Record<string, React.ReactNode> = {
      clients: <Users className="h-4 w-4" />,
      jobs: <Briefcase className="h-4 w-4" />,
      invoices: <FileText className="h-4 w-4" />,
      estimates: <FileSpreadsheet className="h-4 w-4" />,
      payments: <DollarSign className="h-4 w-4" />,
      issues: <AlertCircle className="h-4 w-4" />,
      assets: <Package className="h-4 w-4" />,
      items: <Box className="h-4 w-4" />,
      timesheets: <Clock className="h-4 w-4" />,
      expenses: <Receipt className="h-4 w-4" />,
      purchases: <Receipt className="h-4 w-4" />,
      vendors: <Building2 className="h-4 w-4" />,
      kb_articles: <BookOpen className="h-4 w-4" />,
      kb_attachments: <BookOpen className="h-4 w-4" />,
      profiles: <Users className="h-4 w-4" />,
      company_settings: <Settings className="h-4 w-4" />,
    };
    return icons[entityType] || <History className="h-4 w-4" />;
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "created": return <Plus className="h-3 w-3" />;
      case "updated": return <Pencil className="h-3 w-3" />;
      case "deleted": return <Trash2 className="h-3 w-3" />;
      default: return null;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "created": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "updated": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "deleted": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getEntityLink = (entityType: string, entityId: string | null) => {
    if (!entityId) return null;
    const routes: Record<string, string> = {
      clients: `/clients/${entityId}`,
      jobs: `/jobs/${entityId}`,
      invoices: `/invoices/${entityId}`,
      issues: `/issues/${entityId}`,
      assets: `/assets/${entityId}`,
      items: `/inventory/${entityId}`,
      vendors: `/vendors/${entityId}`,
      kb_articles: `/knowledge-base/${entityId}`,
    };
    return routes[entityType] || null;
  };

  // Get a brief summary of what changed for updates
  const getChangeSummary = (entry: ActivityLogEntry): string | null => {
    if (entry.action !== 'updated') return null;
    
    const oldObj = (typeof entry.old_values === 'object' && entry.old_values !== null) 
      ? entry.old_values as Record<string, unknown> : null;
    const newObj = (typeof entry.new_values === 'object' && entry.new_values !== null) 
      ? entry.new_values as Record<string, unknown> : null;
    
    if (!oldObj || !newObj) return null;
    
    const excludedFields = ['id', 'user_id', 'created_at', 'updated_at', 'created_by', 'updated_by'];
    const changedFields: string[] = [];
    
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
    allKeys.forEach(key => {
      if (excludedFields.includes(key)) return;
      if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
        changedFields.push(key.replace(/_/g, ' '));
      }
    });
    
    if (changedFields.length === 0) return null;
    if (changedFields.length <= 3) return changedFields.join(', ');
    return `${changedFields.slice(0, 2).join(', ')} +${changedFields.length - 2} more`;
  };

  // Group entries by date
  const groupedEntries = entries.reduce((groups, entry) => {
    const date = startOfDay(new Date(entry.created_at)).toISOString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(entry);
    return groups;
  }, {} as Record<string, ActivityLogEntry[]>);

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "EEEE, MMMM d");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Activity Log</h1>
        <p className="text-muted-foreground">Track all changes across your business</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Narrow down activity by type, action, or time period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Entity Type" />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                {ACTIONS.map(action => (
                  <SelectItem key={action.value} value={action.value}>{action.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map(source => (
                  <SelectItem key={source.value} value={source.value}>{source.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGES.map(range => (
                  <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
          <CardDescription>
            {loading ? "Loading..." : `${entries.length} entries found`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading activity...</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8">
              <History className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No activity found</p>
              <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-6">
                {Object.entries(groupedEntries).map(([dateStr, dayEntries]) => (
                  <div key={dateStr}>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 sticky top-0 bg-card py-1">
                      {getDateLabel(dateStr)}
                    </h3>
                    <div className="space-y-2">
                      {dayEntries.map((entry) => {
                        const link = getEntityLink(entry.entity_type, entry.entity_id);
                        const isExpanded = expandedId === entry.id;
                        const changeSummary = getChangeSummary(entry);
                        
                        return (
                          <div key={entry.id} className="border rounded-lg overflow-hidden">
                            <div
                              className="flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                              onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                            >
                              <div className="p-2 rounded-full bg-muted">
                                {getEntityIcon(entry.entity_type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className={getActionColor(entry.action)}>
                                    {getActionIcon(entry.action)}
                                    <span className="ml-1 capitalize">{entry.action}</span>
                                  </Badge>
                                  <span className="text-sm font-medium capitalize">
                                    {entry.entity_type.replace('_', ' ')}
                                  </span>
                                  {entry.entity_name && (
                                    <>
                                      <span className="text-muted-foreground">·</span>
                                      {link && entry.action !== "deleted" ? (
                                        <Link 
                                          to={link} 
                                          className="text-sm text-primary hover:underline"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {entry.entity_name}
                                        </Link>
                                      ) : (
                                        <span className="text-sm text-muted-foreground">
                                          {entry.entity_name}
                                        </span>
                                      )}
                                    </>
                                  )}
                                  {changeSummary && (
                                    <>
                                      <span className="text-muted-foreground">·</span>
                                      <span className="text-xs text-muted-foreground italic">
                                        changed: {changeSummary}
                                      </span>
                                    </>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                  {entry.source === 'api' ? (
                                    <span className="flex items-center gap-1">
                                      <Key className="h-3 w-3" />
                                      {entry.api_key?.name || 'API'}
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1">
                                      <Monitor className="h-3 w-3" />
                                      {entry.user?.full_name || entry.user?.email || "System"}
                                    </span>
                                  )}
                                  <span>·</span>
                                  <span>{formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}</span>
                                  {entry.source === 'api' && (
                                    <>
                                      <span>·</span>
                                      <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                        <Globe className="h-3 w-3 mr-1" />
                                        API
                                      </Badge>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {isExpanded && (entry.old_values || entry.new_values) && (
                              <div className="border-t bg-muted/30 p-3">
                                <ActivityDetails
                                  action={entry.action}
                                  oldValues={entry.old_values}
                                  newValues={entry.new_values}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
