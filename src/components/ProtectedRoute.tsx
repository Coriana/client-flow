import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  resource?: string;
  action?: 'read' | 'write';
  fallback?: string;
}

export default function ProtectedRoute({ 
  children, 
  resource,
  action = 'read',
  fallback = '/dashboard'
}: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { canRead, canWrite, loading: permLoading } = usePermissions();

  if (authLoading || permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If a resource is specified, check permissions
  if (resource) {
    const hasPermission = action === 'write' ? canWrite(resource) : canRead(resource);
    if (!hasPermission) {
      return <Navigate to={fallback} replace />;
    }
  }

  return <>{children}</>;
}
