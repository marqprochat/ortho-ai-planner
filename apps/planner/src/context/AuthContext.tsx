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
            // Check for token in URL (from Portal)
            const params = new URLSearchParams(window.location.search);
            const tokenFromUrl = params.get('token');

            if (tokenFromUrl) {
                setCookie('token', tokenFromUrl);
                // Remove token from URL
                params.delete('token');
                const newRelativePathQuery = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
                window.history.replaceState({}, '', newRelativePathQuery);
            }

            if (authService.isAuthenticated()) {
                try {
                    const { user } = await authService.getMe();
                    setUser(user);
                } catch (error) {
                    console.error('Failed to fetch user:', error);
                    authService.logout();
                }
            }
            setIsLoading(false);
        };

        const timer = setTimeout(() => {
            initAuth();
        }, 100);

        return () => clearTimeout(timer);
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
