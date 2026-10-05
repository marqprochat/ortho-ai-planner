import { getCookie } from '../lib/cookieUtils';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export interface Dentist {
    id: string;
    clinicId: string;
    easyDentalId: string | null;
    name: string;
    cro: string;
    isActive: boolean;
}

export interface DentistInput {
    name: string;
    cro: string;
    easyDentalId?: string;
    isActive?: boolean;
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

const failure = async (response: Response, fallback: string): Promise<Error> => {
    try {
        const body = await response.json();
        return new Error(body.error || fallback);
    } catch {
        return new Error(fallback);
    }
};

export const dentistService = {
    async list(includeInactive = false): Promise<Dentist[]> {
        const response = await fetch(`${API_URL}/dentists${includeInactive ? '?includeInactive=true' : ''}`, {
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw await failure(response, 'Erro ao buscar dentistas');
        return response.json();
    },

    async create(data: DentistInput): Promise<Dentist> {
        const response = await fetch(`${API_URL}/dentists`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        if (!response.ok) throw await failure(response, 'Erro ao criar dentista');
        return response.json();
    },

    async update(id: string, data: DentistInput): Promise<Dentist> {
        const response = await fetch(`${API_URL}/dentists/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        if (!response.ok) throw await failure(response, 'Erro ao atualizar dentista');
        return response.json();
    },

    async remove(id: string): Promise<{ deleted?: boolean; deactivated?: boolean }> {
        const response = await fetch(`${API_URL}/dentists/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) throw await failure(response, 'Erro ao excluir dentista');
        return response.json();
    },
};
