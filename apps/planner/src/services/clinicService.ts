import { getCookie } from '../lib/cookieUtils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface Clinic {
    id: string;
    name: string;
    address: string | null;
    tenantId: string;
    nickname?: string | null;
    logoUrl?: string | null;
    cro?: string | null;
    website?: string | null;
    zipCode?: string | null;
    street?: string | null;
    number?: string | null;
    complement?: string | null;
    district?: string | null;
    city?: string | null;
    state?: string | null;
}

export const clinicService = {
    async getClinics(): Promise<Clinic[]> {
        const token = getCookie('token');
        if (!token) throw new Error('No token');

        const response = await fetch(`${API_URL}/clinics`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch clinics');
        }

        return response.json();
    },

    async updateClinic(id: string, data: Partial<Clinic>): Promise<Clinic> {
        const token = getCookie('token');
        if (!token) throw new Error('No token');

        const response = await fetch(`${API_URL}/clinics/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Failed to update clinic');
        }

        return response.json();
    }
};
