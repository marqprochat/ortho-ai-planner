import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, User } from '../services/authService';
import { setCookie } from '../lib/cookieUtils';

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            console.log('[AuthContext] initAuth started');
            console.log('[AuthContext] window.location.search:', window.location.search);

            // Check for token in URL (from Portal)
            const params = new URLSearchParams(window.location.search);
            const tokenFromUrl = params.get('token');
            console.log('[AuthContext] tokenFromUrl:', tokenFromUrl ? 'FOUND' : 'NOT FOUND');

            if (tokenFromUrl) {
                setCookie('token', tokenFromUrl);
                console.log('[AuthContext] Token saved to cookie');
                // Remove token from URL
                params.delete('token');
                const newRelativePathQuery = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
                window.history.replaceState({}, '', newRelativePathQuery);
            }

            const isAuth = authService.isAuthenticated();
            console.log('[AuthContext] isAuthenticated:', isAuth);

            if (isAuth) {
                try {
                    const { user } = await authService.getMe();
                    console.log('[AuthContext] User fetched:', user.email);
                    setUser(user);
                } catch (error) {
                    console.error('Failed to fetch user:', error);
                    authService.logout();
                }
            } else {
                console.log('[AuthContext] Not authenticated, will redirect to login');
            }
            setIsLoading(false);
        };

        initAuth();
    }, []);

    const login = async (email: string, password: string) => {
        const { user } = await authService.login(email, password);
        setUser(user);
    };

    const logout = () => {
        authService.logout();
        setUser(null);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                isAuthenticated: !!user,
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
