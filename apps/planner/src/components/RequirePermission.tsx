import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface RequirePermissionProps {
    action: string;
    resource: string;
}

export const RequirePermission = ({ action, resource }: RequirePermissionProps) => {
    const { user, isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return <div>Carregando...</div>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (user?.isSuperAdmin) {
        return <Outlet />;
    }

    // Check if user has the specific permission in any of their roles
    // We filter by 'planner' app implicitly because we are in the planner app context,
    // but the permissions are flattened in the user object structure we get from backend (usually).
    // Wait, let's check authService structure. appAccess -> role -> permissions.

    const hasPermission = user?.appAccess?.some((access: any) =>
        // Check if role and permissions exist before accessing them
        access.role?.permissions?.some((p: any) =>
            (p.action === action || p.action === 'manage') &&
            (p.resource === resource || p.resource === 'all')
        )
    );

    if (!hasPermission) {
        return <Navigate to="/access-denied" replace />;
    }

    return <Outlet />;
};
