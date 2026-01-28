import { getCookie } from '../lib/cookieUtils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface Clinic {
    id: string;
    name: string;
    address: string;
    tenantId: string;
    nickname?: string;
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
    }
};
