import { ReactNode } from 'react';
import { usePermissions } from '@/contexts/PermissionContext';

interface PermissionGateProps {
  resource: string;
  action?: 'read' | 'write';
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({ 
  resource, 
  action = 'read', 
  children, 
  fallback = null 
}: PermissionGateProps) {
  const { canRead, canWrite, loading } = usePermissions();
  
  if (loading) {
    return null;
  }
  
  const hasPermission = action === 'write' ? canWrite(resource) : canRead(resource);
  
  if (!hasPermission) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

interface MultiPermissionGateProps {
  resources: string[];
  action?: 'read' | 'write';
  requireAll?: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}

export function MultiPermissionGate({ 
  resources, 
  action = 'read', 
  requireAll = false,
  children, 
  fallback = null 
}: MultiPermissionGateProps) {
  const { canRead, canWrite, loading } = usePermissions();
  
  if (loading) {
    return null;
  }
  
  const checkFn = action === 'write' ? canWrite : canRead;
  const hasPermission = requireAll 
    ? resources.every(r => checkFn(r))
    : resources.some(r => checkFn(r));
  
  if (!hasPermission) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}
