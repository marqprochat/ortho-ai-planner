import { getCookie } from '../lib/cookieUtils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const getAuthHeaders = () => {
    const token = getCookie('token');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
};

export interface Clinic {
    id: string;
    name: string;
    address?: string;
    nickname?: string;
    tenantId: string;
}

export interface Role {
    id: string;
    name: string;
    description?: string;
    permissions: Permission[];
}

export interface Permission {
    id: string;
    action: string;
    resource: string;
    description?: string;
    application?: {
        id: string;
        name: string;
        displayName: string;
    }
}

export interface User {
    id: string;
    name: string;
    email: string;
    nickname?: string;
    cro?: string;
    tenantId: string;
    isSuperAdmin?: boolean;
    canTransferPatient?: boolean;
    appAccess?: any[];
    clinics?: Clinic[]; // Assigned clinics
    clinicIds?: string[]; // For create/update payload
    roleId?: string; // For create/update and display
}

export const adminService = {
    // Clinics
    async getClinics(): Promise<Clinic[]> {
        const response = await fetch(`${API_URL}/clinics`, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Failed to fetch clinics');
        return response.json();
    },

    async createClinic(data: Partial<Clinic>): Promise<Clinic> {
        const response = await fetch(`${API_URL}/clinics`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to create clinic');
        return response.json();
    },

    async updateClinic(id: string, data: Partial<Clinic>): Promise<Clinic> {
        const response = await fetch(`${API_URL}/clinics/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update clinic');
        return response.json();
    },

    async deleteClinic(id: string): Promise<void> {
        const response = await fetch(`${API_URL}/clinics/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Failed to delete clinic');
    },

    // Roles
    async getRoles(): Promise<Role[]> {
        const response = await fetch(`${API_URL}/roles`, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Failed to fetch roles');
        return response.json();
    },

    async getPermissions(): Promise<Permission[]> {
        const response = await fetch(`${API_URL}/permissions`, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Failed to fetch permissions');
        return response.json();
    },

    async createRole(data: Partial<Role> & { permissionIds: string[] }): Promise<Role> {
        const response = await fetch(`${API_URL}/roles`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to create role');
        }
        return response.json();
    },

    async updateRole(id: string, data: Partial<Role> & { permissionIds?: string[] }): Promise<Role> {
        const response = await fetch(`${API_URL}/roles/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to update role');
        }
        return response.json();
    },

    async deleteRole(id: string): Promise<void> {
        const response = await fetch(`${API_URL}/roles/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Failed to delete role');
    },

    // Users
    async getUsers(): Promise<User[]> {
        const response = await fetch(`${API_URL}/users`, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Failed to fetch users');
        return response.json();
    },

    async createUser(data: Partial<User> & { password?: string }): Promise<User> {
        const response = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to create user');
        return response.json();
    },

    async updateUser(id: string, data: Partial<User>): Promise<User> {
        const response = await fetch(`${API_URL}/users/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update user');
        return response.json();
    },

    async deleteUser(id: string): Promise<void> {
        const response = await fetch(`${API_URL}/users/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Failed to delete user');
    },
};
