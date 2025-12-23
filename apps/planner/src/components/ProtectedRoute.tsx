import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = () => {
    const { isAuthenticated, isLoading, user } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return <div>Carregando...</div>; // Or a proper loading spinner
    }

    if (!isAuthenticated) {
        // Redirect to the login page, but save the current location they were trying to go to
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Check for planner app access
    const isSuperAdmin = user?.isSuperAdmin;
    const hasPlannerAccess = user?.appAccess?.some(
        (access: any) => access.application.name === 'planner'
    );

    if (!isSuperAdmin && !hasPlannerAccess) {
        return <Navigate to="/access-denied" replace />;
    }

    return <Outlet />;
};
