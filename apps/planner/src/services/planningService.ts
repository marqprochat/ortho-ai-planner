import { getCookie } from '../lib/cookieUtils';

const API_URL = 'http://localhost:3000/api';

export interface Planning {
    id: string;
    title: string;
    patientId: string;
    status: 'DRAFT' | 'COMPLETED';
    originalReport?: string;
    aiResponse?: string;
    structuredPlan?: any;
    createdAt: string;
    updatedAt: string;
    patient?: {
        name: string;
        id: string;
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

export const planningService = {
    getAllPlannings: async (): Promise<Planning[]> => {
        const response = await fetch(`${API_URL}/plannings`, {
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            throw new Error('Erro ao buscar planejamentos');
        }

        return response.json();
    },

    getPlanningsByPatient: async (patientId: string): Promise<Planning[]> => {
        const response = await fetch(`${API_URL}/patients/${patientId}/plannings`, {
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            throw new Error('Erro ao buscar planejamentos do paciente');
        }

        return response.json();
    },

    createPlanning: async (data: any) => {
        const response = await fetch(`${API_URL}/plannings`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error('Erro ao criar planejamento');
        }

        return response.json();
    },

    updatePlanning: async (id: string, data: any) => {
        const response = await fetch(`${API_URL}/plannings/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error('Erro ao atualizar planejamento');
        }

        return response.json();
    },

    getContracts: async (): Promise<any[]> => {
        const response = await fetch(`${API_URL}/contracts`, {
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            // If the endpoint doesn't exist yet, we might need to handle it
            // but for now let's assume it does or we'll create it.
            return [];
        }

        return response.json();
    }
};
