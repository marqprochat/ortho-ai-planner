import { setCookie, getCookie, removeCookie } from '../lib/cookieUtils';
import { useNavigate } from "react-router-dom";

// Mirrors the User interface from Portal, but simplified for usage if needed
export interface User {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string;
    tenantId: string;
    isSuperAdmin?: boolean;
    tenant: { id: string; name: string };
    appAccess?: Array<{
        application: { id: string; name: string; displayName: string; icon?: string; url?: string };
        role: {
            id: string;
            name: string;
            permissions: Array<{
                id: string;
                action: string;
                resource: string;
                description?: string;
            }>;
        };
    }>;
}

export interface AuthResponse {
    user: User;
    token: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'; // Ensure this matches your backend URL

export const authService = {
    async login(email: string, password: string): Promise<AuthResponse> {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao fazer login');
        }

        const data = await response.json();
        setCookie('token', data.token);
        return data;
    },

    async getMe(): Promise<{ user: User }> {
        const token = getCookie('token');
        if (!token) {
            throw new Error('Token não encontrado');
        }

        const response = await fetch(`${API_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            removeCookie('token');
            throw new Error('Sessão expirada');
        }

        return response.json();
    },

    logout(): void {
        removeCookie('token');
        // Optional: Redirect to login or clear state
    },

    getToken(): string | null {
        return getCookie('token') || null;
    },

    isAuthenticated(): boolean {
        return !!getCookie('token');
    },
};
