import { getCookie } from '../lib/cookieUtils';

const API_URL = 'http://localhost:3000/api';

export interface Patient {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    birthDate?: string;
    tenantId: string;
    userId: string;
    clinicId?: string;
    createdAt: string;
    updatedAt: string;
    _count?: {
        plannings: number;
        contracts: number;
    };
    plannings?: Planning[];
    contracts?: Contract[];
}

export interface Planning {
    id: string;
    title: string;
    status: string;
    patientId: string;
    originalReport?: string;
    aiResponse?: string;
    structuredPlan?: any;
    createdAt: string;
    updatedAt: string;
}

export interface Contract {
    id: string;
    patientId: string;
    content: string;
    logoUrl?: string;
    createdAt: string;
    updatedAt: string;
}

const getAuthHeaders = () => {
    const token = getCookie('token');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
};

export const patientService = {
    async getPatients(): Promise<Patient[]> {
        const response = await fetch(`${API_URL}/patients`, {
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            throw new Error('Erro ao buscar pacientes');
        }

        return response.json();
    },

    async getPatient(id: string): Promise<Patient> {
        const response = await fetch(`${API_URL}/patients/${id}`, {
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            throw new Error('Erro ao buscar paciente');
        }

        return response.json();
    },

    async createPatient(data: { name: string; email?: string; phone?: string; birthDate?: string; clinicId?: string }): Promise<Patient> {
        const response = await fetch(`${API_URL}/patients`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error('Erro ao criar paciente');
        }

        return response.json();
    },

    async updatePatient(id: string, data: { name?: string; email?: string; phone?: string; birthDate?: string; clinicId?: string }): Promise<Patient> {
        const response = await fetch(`${API_URL}/patients/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error('Erro ao atualizar paciente');
        }

        return response.json();
    },

    async createPlanning(data: { patientId: string; title: string; originalReport?: string }): Promise<Planning> {
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

    async updatePlanning(id: string, data: { status?: string; aiResponse?: string; structuredPlan?: any }): Promise<Planning> {
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
};
