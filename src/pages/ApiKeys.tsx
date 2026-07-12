import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionContext';
import { Key, Plus, Trash2, Copy, Clock, Shield, Activity, AlertTriangle } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  user_id: string;
}

interface ApiRequestLog {
  id: string;
  api_key_id: string | null;
  endpoint: string;
  method: string;
  status_code: number;
  response_summary: string;
  duration_ms: number;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  api_key?: { name: string; key_prefix: string } | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
}

const AVAILABLE_SCOPES = [
  { value: '*', label: 'All Resources' },
  { value: 'clients', label: 'Clients' },
  { value: 'jobs', label: 'Jobs' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'payments', label: 'Payments' },
  { value: 'assets', label: 'Assets' },
  { value: 'issues', label: 'Issues' },
  { value: 'vendors', label: 'Vendors' },
  { value: 'items', label: 'Inventory Items' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'banking', label: 'Banking' },
];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function ApiKeys() {
  const { user } = useAuth();
  const { isOwner, canWrite } = usePermissions();
  const { toast } = useToast();
  
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [requestLogs, setRequestLogs] = useState<ApiRequestLog[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState('');
  const [selectedKeyLogs, setSelectedKeyLogs] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('keys');
  
  // Create form state
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['*']);
  const [newKeyExpiry, setNewKeyExpiry] = useState<string>('never');
  const [newKeyUserId, setNewKeyUserId] = useState<string>('');

  const canManageKeys = canWrite('api_keys') || isOwner;

  useEffect(() => {
    fetchApiKeys();
    if (isOwner) {
      fetchProfiles();
    }
  }, [isOwner]);

  const fetchApiKeys = async () => {
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApiKeys(data || []);
    } catch (error) {
      console.error('Error fetching API keys:', error);
      toast({ title: 'Error', description: 'Failed to load API keys', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name');

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  };

  const fetchLogsForKey = async (keyId: string | null) => {
    try {
      let query = supabase
        .from('api_request_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (keyId) {
        query = query.eq('api_key_id', keyId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch API key names for the logs
      const apiKeyIds = [...new Set((data || []).map(e => e.api_key_id).filter(Boolean))];
      let apiKeyMap: Record<string, { name: string; key_prefix: string }> = {};
      
      if (apiKeyIds.length > 0) {
        const { data: keys } = await supabase
          .from('api_keys')
          .select('id, name, key_prefix')
          .in('id', apiKeyIds);
        
        apiKeyMap = (keys || []).reduce((acc, k) => {
          acc[k.id] = { name: k.name, key_prefix: k.key_prefix };
          return acc;
        }, {} as Record<string, { name: string; key_prefix: string }>);
      }

      const logsWithKeyInfo = (data || []).map(log => ({
        ...log,
        api_key: log.api_key_id ? apiKeyMap[log.api_key_id] : null
      }));

      setRequestLogs(logsWithKeyInfo);
      setSelectedKeyLogs(keyId);
    } catch (error) {
      console.error('Error fetching logs:', error);
      toast({ title: 'Error', description: 'Failed to load request logs', variant: 'destructive' });
    }
  };

  const fetchAllLogs = async () => {
    await fetchLogsForKey(null);
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast({ title: 'Error', description: 'Please enter a key name', variant: 'destructive' });
      return;
    }

    try {
      let expiresAt: string | null = null;
      if (newKeyExpiry !== 'never') {
        const days = parseInt(newKeyExpiry);
        const date = new Date();
        date.setDate(date.getDate() + days);
        expiresAt = date.toISOString();
      }

      const keyUserId = isOwner && newKeyUserId ? newKeyUserId : user?.id;
      const token = localStorage.getItem('auth_token');

      const response = await fetch(`${API_URL}/auth/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newKeyName,
          scopes: newKeyScopes,
          expires_at: expiresAt,
          user_id: keyUserId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create API key');
      }

      setNewKeyValue(data.key);
      setShowCreateDialog(false);
      setShowKeyDialog(true);
      setNewKeyName('');
      setNewKeyScopes(['*']);
      setNewKeyExpiry('never');
      setNewKeyUserId('');
      
      fetchApiKeys();
      toast({ title: 'Success', description: 'API key created successfully' });
    } catch (error: any) {
      console.error('Error creating API key:', error);
      toast({ title: 'Error', description: error.message || 'Failed to create API key', variant: 'destructive' });
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .update({ is_active: false })
        .eq('id', keyId);

      if (error) throw error;
      
      fetchApiKeys();
      toast({ title: 'Success', description: 'API key revoked' });
    } catch (error) {
      console.error('Error revoking API key:', error);
      toast({ title: 'Error', description: 'Failed to revoke API key', variant: 'destructive' });
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', keyId);

      if (error) throw error;
      
      fetchApiKeys();
      if (selectedKeyLogs === keyId) {
        setSelectedKeyLogs(null);
        setRequestLogs([]);
      }
      toast({ title: 'Success', description: 'API key deleted' });
    } catch (error) {
      console.error('Error deleting API key:', error);
      toast({ title: 'Error', description: 'Failed to delete API key', variant: 'destructive' });
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for non-secure contexts (HTTP)
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      toast({ title: 'Copied', description: 'API key copied to clipboard' });
    } catch (err) {
      console.error('Failed to copy:', err);
      toast({ title: 'Error', description: 'Failed to copy to clipboard', variant: 'destructive' });
    }
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400';
      case 'POST': return 'bg-blue-500/20 text-blue-700 dark:text-blue-400';
      case 'PUT':
      case 'PATCH': return 'bg-amber-500/20 text-amber-700 dark:text-amber-400';
      case 'DELETE': return 'bg-red-500/20 text-red-700 dark:text-red-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-emerald-600 dark:text-emerald-400';
    if (status >= 400 && status < 500) return 'text-amber-600 dark:text-amber-400';
    if (status >= 500) return 'text-red-600 dark:text-red-400';
    return 'text-muted-foreground';
  };

  if (!canManageKeys) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="p-6 text-center">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to manage API keys.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API Keys</h1>
          <p className="text-muted-foreground">Manage API keys for programmatic access and integrations</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create API Key
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => {
        setActiveTab(value);
        if (value === 'logs' && requestLogs.length === 0) {
          fetchAllLogs();
        }
      }} className="space-y-4">
        <TabsList>
          <TabsTrigger value="keys" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Request Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="keys">
          <Card>
            <CardHeader>
              <CardTitle>Active Keys</CardTitle>
              <CardDescription>
                API keys allow external applications and AI tools to access your data programmatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : apiKeys.length === 0 ? (
                <div className="text-center py-8">
                  <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No API keys created yet</p>
                  <Button variant="outline" className="mt-4" onClick={() => setShowCreateDialog(true)}>
                    Create your first API key
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Key Prefix</TableHead>
                      <TableHead>Scopes</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys.map((key) => (
                      <TableRow key={key.id}>
                        <TableCell className="font-medium">{key.name}</TableCell>
                        <TableCell>
                          <code className="text-sm bg-muted px-2 py-1 rounded">{key.key_prefix}...</code>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {key.scopes.length === 0 || key.scopes.includes('*') ? (
                              <Badge variant="secondary">All</Badge>
                            ) : (
                              key.scopes.slice(0, 3).map((scope) => (
                                <Badge key={scope} variant="outline" className="text-xs">
                                  {scope}
                                </Badge>
                              ))
                            )}
                            {key.scopes.length > 3 && (
                              <Badge variant="outline" className="text-xs">+{key.scopes.length - 3}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {key.is_active ? (
                            <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">Active</Badge>
                          ) : (
                            <Badge variant="destructive">Revoked</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {key.last_used_at ? (
                            formatDistanceToNow(new Date(key.last_used_at), { addSuffix: true })
                          ) : (
                            'Never'
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {key.expires_at ? (
                            <span className={new Date(key.expires_at) < new Date() ? 'text-red-500 dark:text-red-400' : ''}>
                              {format(new Date(key.expires_at), 'MMM d, yyyy')}
                            </span>
                          ) : (
                            'Never'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              title="View request logs for this key"
                              onClick={() => {
                                fetchLogsForKey(key.id);
                                setActiveTab('logs');
                              }}
                            >
                              <Activity className="h-4 w-4" />
                            </Button>
                            {key.is_active && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRevokeKey(key.id)}
                              >
                                <AlertTriangle className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteKey(key.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Request Logs</CardTitle>
                  <CardDescription>
                    {selectedKeyLogs ? (
                      <>Showing requests for: <span className="font-medium text-foreground">{apiKeys.find(k => k.id === selectedKeyLogs)?.name || 'selected key'}</span></>
                    ) : (
                      <>Showing all API requests</>
                    )}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {selectedKeyLogs && (
                    <Button variant="outline" size="sm" onClick={fetchAllLogs}>
                      Show All
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => fetchLogsForKey(selectedKeyLogs)}>
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {requestLogs.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No API requests logged yet</p>
                  <p className="text-sm text-muted-foreground mt-1">API requests will appear here when your keys are used</p>
                  {requestLogs.length === 0 && !selectedKeyLogs && (
                    <Button variant="outline" className="mt-4" onClick={fetchAllLogs}>
                      Load Request Logs
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>API Key</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>IP Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requestLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                        </TableCell>
                        <TableCell>
                          {log.api_key ? (
                            <div className="flex items-center gap-1">
                              <Key className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{log.api_key.name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Unknown</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={getMethodColor(log.method)}>{log.method}</Badge>
                        </TableCell>
                        <TableCell>
                          <code className="text-sm">{log.endpoint}</code>
                        </TableCell>
                        <TableCell>
                          <span className={getStatusColor(log.status_code)}>{log.status_code}</span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {log.duration_ms}ms
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {log.ip_address || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create API Key Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Create a new API key for programmatic access. The key will only be shown once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="keyName">Key Name</Label>
              <Input
                id="keyName"
                placeholder="e.g., Production Integration, AI Assistant"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
            
            {isOwner && profiles.length > 0 && (
              <div>
                <Label htmlFor="keyUser">User (Service Account)</Label>
                <Select value={newKeyUserId} onValueChange={setNewKeyUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user (defaults to you)" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.full_name || profile.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  The key will inherit this user's permissions
                </p>
              </div>
            )}

            <div>
              <Label>Scopes</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {AVAILABLE_SCOPES.map((scope) => (
                  <label key={scope.value} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={newKeyScopes.includes(scope.value)}
                      onChange={(e) => {
                        if (scope.value === '*') {
                          setNewKeyScopes(e.target.checked ? ['*'] : []);
                        } else {
                          if (e.target.checked) {
                            setNewKeyScopes([...newKeyScopes.filter(s => s !== '*'), scope.value]);
                          } else {
                            setNewKeyScopes(newKeyScopes.filter(s => s !== scope.value));
                          }
                        }
                      }}
                      className="rounded"
                    />
                    {scope.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="keyExpiry">Expiration</Label>
              <Select value={newKeyExpiry} onValueChange={setNewKeyExpiry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Never expires</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="180">180 days</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateKey}>Create Key</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show New Key Dialog */}
      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500 dark:text-amber-400" />
              Save Your API Key
            </DialogTitle>
            <DialogDescription>
              This is the only time you'll see this key. Copy it now and store it securely.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <code className="text-sm break-all">{newKeyValue}</code>
            </div>
            <Button className="w-full" onClick={() => copyToClipboard(newKeyValue)}>
              <Copy className="h-4 w-4 mr-2" />
              Copy to Clipboard
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowKeyDialog(false); setNewKeyValue(''); }}>
              I've Saved My Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
