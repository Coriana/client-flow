import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

export type PermissionLevel = 'none' | 'read' | 'write';

export interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
}

interface PermissionContextType {
  permissions: Record<string, PermissionLevel>;
  role: Role | null;
  loading: boolean;
  canRead: (resource: string) => boolean;
  canWrite: (resource: string) => boolean;
  isOwner: boolean;
  refetchPermissions: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Record<string, PermissionLevel>>({});
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  const fetchPermissions = async () => {
    if (!user) {
      setPermissions({});
      setRole(null);
      setIsOwner(false);
      setLoading(false);
      return;
    }

    try {
      // Fetch user's role
      const { data: userRoleData } = await supabase
        .from('user_roles')
        .select(`
          role_id,
          roles:role_id (
            id,
            name,
            description,
            is_system
          )
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (userRoleData?.roles) {
        const roleData = userRoleData.roles as unknown as Role;
        setRole(roleData);
        setIsOwner(roleData.name?.toLowerCase() === 'owner');

        // Fetch permissions for this role
        const { data: permissionsData } = await supabase
          .from('role_permissions')
          .select(`
            permission,
            resources:resource_id (
              name
            )
          `)
          .eq('role_id', roleData.id);

        if (permissionsData) {
          const permMap: Record<string, PermissionLevel> = {};
          permissionsData.forEach((p: any) => {
            if (p.resources?.name) {
              permMap[p.resources.name] = p.permission as PermissionLevel;
            }
          });
          setPermissions(permMap);
        }
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, [user]);

  const canRead = (resource: string): boolean => {
    const perm = permissions[resource];
    return perm === 'read' || perm === 'write';
  };

  const canWrite = (resource: string): boolean => {
    return permissions[resource] === 'write';
  };

  return (
    <PermissionContext.Provider value={{ 
      permissions, 
      role, 
      loading, 
      canRead, 
      canWrite, 
      isOwner,
      refetchPermissions: fetchPermissions 
    }}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
}
