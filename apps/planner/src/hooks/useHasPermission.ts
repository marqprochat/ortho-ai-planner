import { useAuth } from '../context/AuthContext';

/**
 * Hook to check if the current user has a specific permission.
 * Returns true if the user is a Super Admin, or if they have the specified permission
 * in any of their roles.
 */
export const useHasPermission = (action: string, resource: string): boolean => {
    const { user } = useAuth();

    if (!user) return false;

    if (user.isSuperAdmin) return true;

    return user.appAccess?.some((access: any) =>
        access.role?.permissions?.some((p: any) =>
            (p.action === action || p.action === 'manage') &&
            (p.resource === resource || p.resource === 'all')
        )
    ) ?? false;
};
