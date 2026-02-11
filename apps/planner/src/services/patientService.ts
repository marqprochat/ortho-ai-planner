import { getCookie } from '../lib/cookieUtils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface Patient {
    id: string;
    name: string;
    patientNumber?: string;  // Patient registration number (número do paciente)
    paymentType?: string;   // Payment type: 'Convênio' or 'Particular'
    insuranceCompany?: string; // Insurance company name
    email?: string;
    phone?: string;
    birthDate?: string;
    externalId?: string;  // External patient number from another application
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
    contracts?: Contract[];
    createdAt: string;
    updatedAt: string;
}

export interface Contract {
    id: string;
    patientId: string;
    content: string;
    logoUrl?: string;
    isSigned?: boolean;
    signedAt?: string;
    planningId?: string;
    createdAt: string;
    updatedAt: string;
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

    async createPatient(data: { name: string; email?: string; phone?: string; birthDate?: string; clinicId?: string; externalId?: string; patientNumber?: string; paymentType?: string; insuranceCompany?: string }): Promise<Patient> {
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

    async findOrCreatePatient(data: { name: string; email?: string; phone?: string; birthDate?: string; clinicId?: string; externalId?: string; patientNumber?: string; paymentType?: string; insuranceCompany?: string }): Promise<{ patient: Patient; isNew: boolean }> {
        const response = await fetch(`${API_URL}/patients/find-or-create`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error('Erro ao buscar/criar paciente');
        }

        return response.json();
    },

    async updatePatient(id: string, data: { name?: string; email?: string; phone?: string; birthDate?: string; clinicId?: string; externalId?: string; patientNumber?: string; paymentType?: string; insuranceCompany?: string }): Promise<Patient> {
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

    async deletePatient(id: string): Promise<void> {
        const response = await fetch(`${API_URL}/patients/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            throw new Error('Erro ao excluir paciente');
        }
    },

    async createPlanning(data: { patientId: string; title: string; originalReport?: string; status?: string; structuredPlan?: any }): Promise<Planning> {
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

    async deletePlanning(id: string): Promise<void> {
        const response = await fetch(`${API_URL}/plannings/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            throw new Error('Erro ao excluir planejamento');
        }
    },

    async createContract(data: { patientId: string; content: string; logoUrl?: string; planningId?: string }): Promise<Contract> {
        const response = await fetch(`${API_URL}/contracts`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error('Erro ao criar contrato');
        }

        return response.json();
    },

    async getPatientContracts(patientId: string): Promise<Contract[]> {
        const response = await fetch(`${API_URL}/patients/${patientId}/contracts`, {
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            throw new Error('Erro ao buscar contratos');
        }

        return response.json();
    },

    async signContract(contractId: string): Promise<Contract> {
        const response = await fetch(`${API_URL}/contracts/${contractId}/sign`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            throw new Error('Erro ao assinar contrato');
        }

        return response.json();
    },

    async transferPatient(id: string, targetEmail: string): Promise<{ message: string; targetUser: string }> {
        const response = await fetch(`${API_URL}/patients/${id}/transfer`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ targetEmail }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Erro ao transferir paciente');
        }

        return response.json();
    },
};

