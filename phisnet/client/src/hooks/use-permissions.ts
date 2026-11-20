// Create: phisnet/client/src/hooks/use-permissions.tsx
import { useAuth } from "./use-auth";
import { PERMISSIONS } from "@shared/schema";
import { can } from '@shared/access-control';

export function usePermissions() {
  const { user } = useAuth();

  const hasPermission = (permission: string): boolean => {
    return can(user, permission);
  };

  const hasAnyPermission = (permissions: string[]): boolean => {
    // Safety check for undefined or null permissions
    if (!permissions || !Array.isArray(permissions)) {
      return false;
    }
    
    return permissions.some(permission => hasPermission(permission));
  };

  const hasAllPermissions = (permissions: string[]): boolean => {
    // Safety check for undefined or null permissions
    if (!permissions || !Array.isArray(permissions)) {
      return false;
    }
    
    return permissions.every(permission => hasPermission(permission));
  };

  const canAccess = (permissionOrPermissions: string | string[]): boolean => {
    if (typeof permissionOrPermissions === 'string') {
      return hasPermission(permissionOrPermissions);
    }
    
    // Safety check for array
    if (!Array.isArray(permissionOrPermissions)) {
      return false;
    }
    
    return hasAnyPermission(permissionOrPermissions);
  };

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccess,
    user,
  };
}

// Export permissions for convenience
export { PERMISSIONS };
