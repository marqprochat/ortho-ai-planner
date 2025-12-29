import { getCookie } from '../lib/cookieUtils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface Contract {
    id: string;
    patientId: string;
    content: string;
    logoUrl?: string;
    createdAt: string;
    updatedAt: string;
    patient?: {
        id: string;
        name: string;
    };
}

const getAuthHeaders = () => {
    const token = getCookie('token');
    const selectedClinicId = localStorage.getItem('selectedClinicId');

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };

    if (selectedClinicId) {
        headers['x-clinic-id'] = selectedClinicId;
    }

    return headers;
};

export const contractService = {
    async getAllContracts(): Promise<Contract[]> {
        const response = await fetch(`${API_URL}/contracts`, {
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            throw new Error('Erro ao buscar contratos');
        }

        return response.json();
    },

    async getContract(id: string): Promise<Contract> {
        const response = await fetch(`${API_URL}/contracts/${id}`, {
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            throw new Error('Erro ao buscar contrato');
        }

        return response.json();
    },

    async deleteContract(id: string): Promise<void> {
        const response = await fetch(`${API_URL}/contracts/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            throw new Error('Erro ao excluir contrato');
        }
    }
};
