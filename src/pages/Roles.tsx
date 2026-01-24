import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Shield, ShieldCheck, ShieldX } from 'lucide-react';
import { usePermissions, PermissionLevel } from '@/contexts/PermissionContext';

interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
}

interface Resource {
  id: string;
  name: string;
  display_name: string;
  category: string | null;
  sort_order: number;
}

interface RolePermission {
  role_id: string;
  resource_id: string;
  permission: PermissionLevel;
}

export default function Roles() {
  const { isOwner } = usePermissions();
  const [roles, setRoles] = useState<Role[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [rolesRes, resourcesRes, permissionsRes] = await Promise.all([
      supabase.from('roles').select('*').order('is_system', { ascending: false }).order('name'),
      supabase.from('resources').select('*').order('sort_order'),
      supabase.from('role_permissions').select('*')
    ]);
    
    setRoles(rolesRes.data || []);
    setResources(resourcesRes.data || []);
    setPermissions(permissionsRes.data || []);
    setLoading(false);
  }

  async function handleCreateRole() {
    if (!newRole.name.trim()) {
      toast({ title: 'Error', description: 'Role name is required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from('roles')
      .insert({ name: newRole.name.toLowerCase().replace(/\s+/g, '_'), description: newRole.description })
      .select()
      .single();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      // Create default permissions (all none) for the new role
      const defaultPerms = resources.map(r => ({
        role_id: data.id,
        resource_id: r.id,
        permission: 'none' as PermissionLevel
      }));
      await supabase.from('role_permissions').insert(defaultPerms);
      
      toast({ title: 'Success', description: 'Role created successfully' });
      setNewRole({ name: '', description: '' });
      setIsDialogOpen(false);
      fetchData();
    }
    setSaving(false);
  }

  async function handleDeleteRole(role: Role) {
    if (role.is_system) {
      toast({ title: 'Error', description: 'System roles cannot be deleted', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('roles').delete().eq('id', role.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Role deleted' });
      fetchData();
    }
  }

  async function handlePermissionChange(roleId: string, resourceId: string, permission: PermissionLevel) {
    const existing = permissions.find(p => p.role_id === roleId && p.resource_id === resourceId);
    
    if (existing) {
      await supabase
        .from('role_permissions')
        .update({ permission })
        .eq('role_id', roleId)
        .eq('resource_id', resourceId);
    } else {
      await supabase
        .from('role_permissions')
        .insert({ role_id: roleId, resource_id: resourceId, permission });
    }
    
    setPermissions(prev => {
      const updated = prev.filter(p => !(p.role_id === roleId && p.resource_id === resourceId));
      return [...updated, { role_id: roleId, resource_id: resourceId, permission }];
    });
  }

  function getPermission(roleId: string, resourceId: string): PermissionLevel {
    return permissions.find(p => p.role_id === roleId && p.resource_id === resourceId)?.permission || 'none';
  }

  const groupedResources = resources.reduce((acc, r) => {
    const cat = r.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(r);
    return acc;
  }, {} as Record<string, Resource[]>);

  if (!isOwner) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldX className="h-5 w-5 text-destructive" />
              Access Denied
            </CardTitle>
            <CardDescription>
              Only owners can manage roles and permissions.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Roles & Permissions</h1>
          <p className="text-muted-foreground">Manage user roles and their access permissions</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Role</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Role</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Role Name</Label>
                <Input 
                  value={newRole.name} 
                  onChange={e => setNewRole(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Finance Manager"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea 
                  value={newRole.description} 
                  onChange={e => setNewRole(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe this role's responsibilities"
                />
              </div>
              <Button onClick={handleCreateRole} disabled={saving} className="w-full">
                {saving ? 'Creating...' : 'Create Role'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Roles List */}
      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
          <CardDescription>Click on a role to edit its permissions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {roles.map(role => (
              <button
                key={role.id}
                onClick={() => setSelectedRole(selectedRole?.id === role.id ? null : role)}
                className={`p-4 rounded-lg border text-left transition-colors ${
                  selectedRole?.id === role.id 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {role.is_system ? (
                      <ShieldCheck className="h-4 w-4 text-primary" />
                    ) : (
                      <Shield className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium capitalize">{role.name}</span>
                  </div>
                  {role.is_system && <Badge variant="secondary">System</Badge>}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {role.description || 'No description'}
                </p>
                {!role.is_system && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-destructive hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); handleDeleteRole(role); }}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />Delete
                  </Button>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Permission Matrix */}
      {selectedRole && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Editing: <span className="capitalize">{selectedRole.name}</span>
            </CardTitle>
            <CardDescription>
              Set permission levels for each resource. Changes are saved automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {Object.entries(groupedResources).map(([category, categoryResources]) => (
                <div key={category}>
                  <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">
                    {category}
                  </h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">Resource</TableHead>
                          <TableHead>Permission</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categoryResources.map(resource => (
                          <TableRow key={resource.id}>
                            <TableCell className="font-medium">{resource.display_name}</TableCell>
                            <TableCell>
                              <RadioGroup
                                value={getPermission(selectedRole.id, resource.id)}
                                onValueChange={(value) => handlePermissionChange(selectedRole.id, resource.id, value as PermissionLevel)}
                                className="flex gap-4"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="none" id={`${resource.id}-none`} />
                                  <Label htmlFor={`${resource.id}-none`} className="text-muted-foreground">
                                    None
                                  </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="read" id={`${resource.id}-read`} />
                                  <Label htmlFor={`${resource.id}-read`}>Read</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="write" id={`${resource.id}-write`} />
                                  <Label htmlFor={`${resource.id}-write`} className="text-primary font-medium">
                                    Write
                                  </Label>
                                </div>
                              </RadioGroup>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
