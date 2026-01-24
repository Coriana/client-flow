import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Building, Briefcase, Clock, AlertCircle, Edit, Key } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import EditProfileDialog from "@/components/EditProfileDialog";
import TeamMemberHistory from "@/components/TeamMemberHistory";
import TeamMemberActivity from "@/components/TeamMemberActivity";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  birthday: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  department: string | null;
  job_title: string | null;
  start_date: string | null;
  notes: string | null;
  is_active: boolean;
  avatar_url: string | null;
  hourly_rate: number | null;
  created_at: string;
}

interface Role {
  id: string;
  name: string;
}

const TeamMemberDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canWrite, role } = usePermissions();
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberRole, setMemberRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<any[]>([]);

  const isOwner = role?.name === 'owner';
  const canManageTeam = canWrite('team');
  const isSelf = user?.id === id;

  const fetchData = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role_id, roles(id, name)')
        .eq('user_id', id)
        .single();

      if (roleData?.roles) {
        setMemberRole(roleData.roles as unknown as Role);
      }

      // Fetch API keys if owner or self
      if (isOwner || isSelf) {
        const { data: keysData } = await supabase
          .from('api_keys')
          .select('id, name, key_prefix, is_active, last_used_at, created_at, expires_at')
          .eq('user_id', id)
          .order('created_at', { ascending: false });

        setApiKeys(keysData || []);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id, user]);

  const getRoleBadgeVariant = (roleName: string) => {
    switch (roleName) {
      case 'owner': return 'default';
      case 'admin': return 'secondary';
      case 'staff': return 'outline';
      default: return 'outline';
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Team member not found</p>
        <Button variant="outline" onClick={() => navigate('/team')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Team
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/team')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="text-lg">{getInitials(profile.full_name)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{profile.full_name || 'Unknown'}</h1>
                {!profile.is_active && (
                  <Badge variant="destructive">Inactive</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                {profile.job_title && <span>{profile.job_title}</span>}
                {profile.job_title && profile.department && <span>•</span>}
                {profile.department && <span>{profile.department}</span>}
                {memberRole && (
                  <>
                    <span>•</span>
                    <Badge variant={getRoleBadgeVariant(memberRole.name)} className="capitalize">
                      {memberRole.name}
                    </Badge>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        {(canManageTeam || isSelf) && (
          <Button onClick={() => setEditDialogOpen(true)}>
            <Edit className="mr-2 h-4 w-4" /> Edit Profile
          </Button>
        )}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          {(isOwner || isSelf) && <TabsTrigger value="api-keys">API Keys</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{profile.email}</span>
                </div>
                {profile.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{profile.phone}</span>
                  </div>
                )}
                {profile.address && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{profile.address}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Work Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Work Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {profile.department && (
                  <div className="flex items-center gap-3">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span>{profile.department}</span>
                  </div>
                )}
                {profile.job_title && (
                  <div className="flex items-center gap-3">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span>{profile.job_title}</span>
                  </div>
                )}
                {profile.start_date && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Started {format(new Date(profile.start_date), 'PP')}</span>
                  </div>
                )}
                {profile.hourly_rate && (
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>${profile.hourly_rate}/hour</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Notes */}
          {profile.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">{profile.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Personal Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Personal Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {profile.birthday && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Birthday</span>
                    <span>{format(new Date(profile.birthday), 'PP')}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Member Since</span>
                  <span>{format(new Date(profile.created_at), 'PP')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={profile.is_active ? 'default' : 'destructive'}>
                    {profile.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Emergency Contact */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Emergency Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {profile.emergency_contact_name ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name</span>
                      <span>{profile.emergency_contact_name}</span>
                    </div>
                    {profile.emergency_contact_phone && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Phone</span>
                        <span>{profile.emergency_contact_phone}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">No emergency contact set</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <TeamMemberActivity memberId={id!} />
        </TabsContent>

        <TabsContent value="history">
          <TeamMemberHistory profileId={id!} />
        </TabsContent>

        {(isOwner || isSelf) && (
          <TabsContent value="api-keys" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">API Keys</CardTitle>
              </CardHeader>
              <CardContent>
                {apiKeys.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No API keys created</p>
                ) : (
                  <div className="space-y-3">
                    {apiKeys.map((key) => (
                      <div key={key.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Key className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{key.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {key.key_prefix}...
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={key.is_active ? 'default' : 'secondary'}>
                            {key.is_active ? 'Active' : 'Revoked'}
                          </Badge>
                          {key.last_used_at && (
                            <span className="text-xs text-muted-foreground">
                              Last used {format(new Date(key.last_used_at), 'PP')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <EditProfileDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        profile={profile}
        onSave={fetchData}
      />
    </div>
  );
};

export default TeamMemberDetail;
