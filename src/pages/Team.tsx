import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, apiFetch } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Users, UserPlus, Shield, Mail, Search, Building, Briefcase, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/EmptyState';
import { ListPagination } from '@/components/ListPagination';
import { usePagination } from '@/hooks/usePagination';

interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean | null;
}

interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  role_id: string | null;
  role_name: string;
  department: string | null;
  job_title: string | null;
  is_active: boolean;
  created_at: string;
}

export default function Team() {
  const { user } = useAuth();
  const { canWrite, isOwner, role: currentUserRole } = usePermissions();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [inviting, setInviting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingInvite, setPendingInvite] = useState<{ email: string; url: string; emailed: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const canManageTeam = canWrite('team');

  useEffect(() => {
    fetchData();
  }, [user]);

  async function fetchData() {
    setLoading(true);
    
    // Fetch roles
    const { data: rolesData } = await supabase
      .from('roles')
      .select('*')
      .order('name');
    
    setRoles(rolesData || []);
    
    // Set default invite role to staff
    const staffRole = rolesData?.find(r => r.name === 'staff');
    if (staffRole) setInviteRoleId(staffRole.id);
    
    // Get all profiles with their roles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name, department, job_title, is_active, created_at')
      .order('created_at');
    
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('user_id, role_id, roles:roles(name)');
    
    const roleMap = new Map<string, { role_id: string; role_name: string }>();
    (userRoles || []).forEach(ur => {
      roleMap.set(ur.user_id, {
        role_id: ur.role_id || '',
        role_name: (ur.roles as any)?.name || 'Unknown'
      });
    });
    
    const teamMembers: TeamMember[] = (profiles || []).map(p => ({
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      department: p.department,
      job_title: p.job_title,
      is_active: p.is_active ?? true,
      role_id: roleMap.get(p.id)?.role_id || null,
      role_name: roleMap.get(p.id)?.role_name || 'No Role',
      created_at: p.created_at,
    }));
    
    setMembers(teamMembers);
    setLoading(false);
  }

  const filteredMembers = members.filter(member => {
    const search = searchTerm.toLowerCase();
    return (
      member.full_name?.toLowerCase().includes(search) ||
      member.email.toLowerCase().includes(search) ||
      member.department?.toLowerCase().includes(search) ||
      member.job_title?.toLowerCase().includes(search) ||
      member.role_name.toLowerCase().includes(search)
    );
  });

  const pagination = usePagination(filteredMembers);

  async function handleInvite() {
    if (!inviteEmail.trim()) {
      toast({ title: 'Error', description: 'Email is required', variant: 'destructive' });
      return;
    }

    setInviting(true);

    try {
      const createResponse = await apiFetch('/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role_id: inviteRoleId || undefined }),
      });

      const data = await createResponse.json();

      if (!createResponse.ok) {
        toast({
          title: 'Error',
          description: data.error || 'Failed to create user',
          variant: 'destructive',
        });
        return;
      }

      const inviteUrl = `${window.location.origin}/signup?token=${data.invite_token}`;

      const emailResponse = await apiFetch('/mail/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, inviteUrl }),
      });

      const emailed = emailResponse.ok;

      setPendingInvite({ email: inviteEmail, url: inviteUrl, emailed });

      if (emailed) {
        toast({ title: 'Success', description: `Invitation emailed to ${inviteEmail}` });
      } else {
        toast({
          title: 'Email not sent',
          description: "Email isn't set up — copy the invite link below to send it yourself.",
        });
      }

      fetchData();
      setInviteEmail('');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send invite',
        variant: 'destructive',
      });
    } finally {
      setInviting(false);
    }
  }

  async function handleCopyInviteLink() {
    if (!pendingInvite) return;
    await navigator.clipboard.writeText(pendingInvite.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleUpdateRole(userId: string, newRoleId: string) {
    const { error } = await supabase
      .from('user_roles')
      .update({ role_id: newRoleId })
      .eq('user_id', userId);
    
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Role updated' });
      fetchData();
    }
  }

  function getRoleBadgeVariant(roleName: string) {
    switch (roleName) {
      case 'owner': return 'default';
      case 'admin': return 'default';
      case 'staff': return 'secondary';
      case 'readonly': return 'outline';
      default: return 'secondary';
    }
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            Team Members
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your team and their access levels
          </p>
        </div>
        {isOwner && (
          <Button asChild variant="outline">
            <Link to="/roles">
              <Shield className="h-4 w-4 mr-2" />
              Manage Roles
            </Link>
          </Button>
        )}
      </div>

      {/* Invite Section - Only for users with team write access */}
      {canManageTeam && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invite Team Member
            </CardTitle>
            <CardDescription>
              Invited members get a link to set their password — it's emailed automatically if
              SMTP is configured, otherwise you can copy it and share it with them yourself.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1 space-y-2">
                <Label>Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="w-40 space-y-2">
                <Label>Role</Label>
                <Select value={inviteRoleId} onValueChange={setInviteRoleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.filter(r => r.name !== 'owner').map(role => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleInvite} disabled={inviting}>
                <UserPlus className="h-4 w-4 mr-2" />
                {inviting ? 'Inviting...' : 'Invite'}
              </Button>
            </div>

            {pendingInvite && (
              <div className="mt-4 rounded-lg border bg-muted/50 p-4 space-y-2">
                <p className="text-sm font-medium">Invite link for {pendingInvite.email}</p>
                <p className="text-sm text-muted-foreground">
                  {pendingInvite.emailed
                    ? 'This link was also emailed to them.'
                    : "Email isn't configured — share this link with them manually."}
                </p>
                <div className="flex gap-2">
                  <Input readOnly value={pendingInvite.url} className="font-mono text-xs" />
                  <Button variant="outline" size="sm" onClick={handleCopyInviteLink}>
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Role Permissions Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Available Roles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            {roles.map(role => (
              <div key={role.id} className="p-3 border rounded-lg">
                <Badge variant={getRoleBadgeVariant(role.name)} className="mb-2 capitalize">
                  {role.name}
                </Badge>
                <p className="text-muted-foreground">{role.description || 'No description'}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Team Members Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Current Team ({filteredMembers.length})</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search team..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No team members yet"
              description={
                canManageTeam
                  ? 'Invite a teammate using the form above to give them access.'
                  : 'Ask a team owner or admin to invite you a colleague.'
              }
            />
          ) : (
            <>
          {/* table (desktop) */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  {canManageTeam && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManageTeam ? 6 : 5} className="text-center py-8">
                      <p className="text-muted-foreground">No matches for "{searchTerm}"</p>
                      <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSearchTerm('')}>
                        Clear search
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                pagination.pageItems.map((member) => (
                  <TableRow
                    key={member.id}
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => navigate(`/team/${member.id}`)}
                  >
                    <TableCell className="font-medium">
                      <div>
                        <div className="flex items-center gap-2">
                          {member.full_name || 'No name set'}
                          {member.id === user?.id && (
                            <Badge variant="outline" className="text-xs">You</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">{member.email}</div>
                        {member.job_title && (
                          <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Briefcase className="h-3 w-3" />
                            {member.job_title}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(member.role_name)} className="capitalize">
                        {member.role_name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {member.department ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Building className="h-3 w-3 text-muted-foreground" />
                          {member.department}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.is_active ? 'default' : 'destructive'}>
                        {member.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(member.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    {canManageTeam && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {member.role_name !== 'owner' && member.id !== user?.id && (
                          <Select
                            value={member.role_id || ''}
                            onValueChange={(v) => handleUpdateRole(member.id, v)}
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {roles.filter(r => r.name !== 'owner').map(role => (
                                <SelectItem key={role.id} value={role.id}>
                                  {role.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {member.role_name === 'owner' && (
                          <span className="text-muted-foreground text-sm">Cannot change</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                )))}
              </TableBody>
            </Table>
          </div>

          {/* cards (mobile) */}
          <div className="space-y-3 md:hidden">
            {filteredMembers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No matches for "{searchTerm}"</p>
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSearchTerm('')}>
                  Clear search
                </Button>
              </div>
            ) : (
            pagination.pageItems.map((member) => (
              <Link
                key={member.id}
                to={`/team/${member.id}`}
                className="block rounded-lg border bg-card p-4 transition-colors active:bg-muted"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{member.full_name || 'No name set'}</span>
                    {member.id === user?.id && (
                      <Badge variant="outline" className="text-xs">You</Badge>
                    )}
                  </div>
                  <Badge variant={getRoleBadgeVariant(member.role_name)} className="capitalize">
                    {member.role_name}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{member.email}</p>
              </Link>
            ))
            )}
          </div>

          <ListPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            startIndex={pagination.startIndex}
            endIndex={pagination.endIndex}
            onPageChange={pagination.setPage}
          />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
