import { setCookie, getCookie, removeCookie } from '../lib/cookieUtils';

const API_URL = '/api';

export interface User {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string;
    tenantId: string;
    tenant: { id: string; name: string };
    isSuperAdmin?: boolean;
    appAccess?: Array<{
        application: { id: string; name: string; displayName: string; icon?: string; url?: string };
        role: { id: string; name: string };
    }>;
}

export interface AuthResponse {
    user: User;
    token: string;
}

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

    async register(email: string, password: string, name: string, tenantName?: string): Promise<AuthResponse> {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name, tenantName }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao registrar');
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
    },

    getToken(): string | null {
        return getCookie('token') || null;
    },

    isAuthenticated(): boolean {
        return !!getCookie('token');
    },
};
