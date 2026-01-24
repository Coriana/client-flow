import { usePermissions, PermissionLevel } from '@/contexts/PermissionContext';

export function usePermission(resource: string) {
  const { permissions, canRead, canWrite, loading } = usePermissions();
  
  return {
    level: (permissions[resource] || 'none') as PermissionLevel,
    canRead: canRead(resource),
    canWrite: canWrite(resource),
    loading
  };
}

export function useResourcePermissions(resources: string[]) {
  const { canRead, canWrite, loading } = usePermissions();
  
  return {
    canReadAny: resources.some(r => canRead(r)),
    canWriteAny: resources.some(r => canWrite(r)),
    canReadAll: resources.every(r => canRead(r)),
    canWriteAll: resources.every(r => canWrite(r)),
    loading
  };
}
