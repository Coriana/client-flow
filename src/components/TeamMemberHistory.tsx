import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, User, Key, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface HistoryEntry {
  id: string;
  event_type: string;
  description: string;
  old_values: any;
  new_values: any;
  changed_by: string | null;
  api_key_id: string | null;
  created_at: string;
  changer_name?: string;
  api_key_name?: string;
}

interface TeamMemberHistoryProps {
  profileId: string;
}

const TeamMemberHistory = ({ profileId }: TeamMemberHistoryProps) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        // Fetch history entries
        const { data: historyData, error } = await supabase
          .from('profile_history')
          .select('*')
          .eq('profile_id', profileId)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Fetch changer names and API key names
        const changerIds = [...new Set(historyData?.filter(h => h.changed_by).map(h => h.changed_by))];
        const apiKeyIds = [...new Set(historyData?.filter(h => h.api_key_id).map(h => h.api_key_id))];

        let changerMap: Record<string, string> = {};
        let apiKeyMap: Record<string, string> = {};

        if (changerIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', changerIds);
          
          profiles?.forEach(p => {
            changerMap[p.id] = p.full_name || 'Unknown';
          });
        }

        if (apiKeyIds.length > 0) {
          const { data: apiKeys } = await supabase
            .from('api_keys')
            .select('id, name, key_prefix')
            .in('id', apiKeyIds);
          
          apiKeys?.forEach(k => {
            apiKeyMap[k.id] = `${k.name} (${k.key_prefix}...)`;
          });
        }

        const enrichedHistory = historyData?.map(h => ({
          ...h,
          changer_name: h.changed_by ? changerMap[h.changed_by] : undefined,
          api_key_name: h.api_key_id ? apiKeyMap[h.api_key_id] : undefined,
        })) || [];

        setHistory(enrichedHistory);
      } catch (error) {
        console.error('Error fetching history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [profileId]);

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getChangedFields = (oldVals: Record<string, any> | null, newVals: Record<string, any> | null) => {
    if (!oldVals || !newVals) return [];
    
    const changes: { field: string; from: any; to: any }[] = [];
    const allKeys = new Set([...Object.keys(oldVals), ...Object.keys(newVals)]);
    
    allKeys.forEach(key => {
      if (JSON.stringify(oldVals[key]) !== JSON.stringify(newVals[key])) {
        changes.push({
          field: key.replace(/_/g, ' '),
          from: oldVals[key],
          to: newVals[key],
        });
      }
    });
    
    return changes;
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return <span className="text-muted-foreground italic">empty</span>;
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
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
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="h-5 w-5" />
          Change History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="text-muted-foreground text-sm">No changes recorded</p>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {history.map((entry) => {
                const isExpanded = expandedItems.has(entry.id);
                const changes = getChangedFields(entry.old_values, entry.new_values);
                
                return (
                  <Collapsible key={entry.id} open={isExpanded} onOpenChange={() => toggleExpanded(entry.id)}>
                    <div className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="capitalize">
                              {entry.event_type}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(entry.created_at), 'PPp')}
                            </span>
                          </div>
                          <p className="text-sm">{entry.description}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {entry.api_key_id ? (
                              <>
                                <Key className="h-3 w-3" />
                                <span>via API: {entry.api_key_name}</span>
                              </>
                            ) : entry.changer_name ? (
                              <>
                                <User className="h-3 w-3" />
                                <span>by {entry.changer_name}</span>
                              </>
                            ) : (
                              <>
                                <User className="h-3 w-3" />
                                <span>System</span>
                              </>
                            )}
                          </div>
                        </div>
                        {changes.length > 0 && (
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </CollapsibleTrigger>
                        )}
                      </div>
                      
                      <CollapsibleContent>
                        {changes.length > 0 && (
                          <div className="mt-4 pt-4 border-t space-y-2">
                            {changes.map((change, idx) => (
                              <div key={idx} className="text-sm grid grid-cols-3 gap-2">
                                <span className="font-medium capitalize">{change.field}</span>
                                <span className="text-muted-foreground">
                                  {formatValue(change.from)}
                                </span>
                                <span>→ {formatValue(change.to)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default TeamMemberHistory;
