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

export type StandardizationRecordType = 'treatment' | 'planning' | 'contract';

export interface StandardizationCandidateItem {
    id: string;
    type: StandardizationRecordType;
    patientId: string | null;
    patientName: string;
    label: string;
    currentName: string | null;
    currentCro: string | null;
    currentDentistId: string | null;
    score: number;
    reason: string;
    isSigned?: boolean;
    snippet?: string;
}

export interface StandardizationPreviewResult {
    dentist: { id: string; name: string; cro: string; isActive: boolean };
    items: StandardizationCandidateItem[];
    summary: {
        total: number;
        treatments: number;
        plannings: number;
        contracts: number;
    };
}

export interface StandardizationSelection {
    treatmentIds: string[];
    planningIds: string[];
    contractIds: string[];
}

export interface StandardizationApplyResult {
    dentist: { id: string; name: string; cro: string };
    updated: {
        treatments: number;
        plannings: number;
        contracts: number;
        total: number;
    };
}

const getAuthHeaders = (clinicId?: string | null) => {
    const token = getCookie('token');
    const resolvedClinicId = clinicId || localStorage.getItem('selectedClinicId');

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };

    if (resolvedClinicId) {
        headers['x-clinic-id'] = resolvedClinicId;
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
    async list(includeInactive = false, clinicId?: string | null): Promise<Dentist[]> {
        const response = await fetch(`${API_URL}/dentists${includeInactive ? '?includeInactive=true' : ''}`, {
            headers: getAuthHeaders(clinicId),
        });
        if (!response.ok) throw await failure(response, 'Erro ao buscar dentistas');
        return response.json();
    },

    async create(data: DentistInput, clinicId?: string | null): Promise<Dentist> {
        const response = await fetch(`${API_URL}/dentists`, {
            method: 'POST',
            headers: getAuthHeaders(clinicId),
            body: JSON.stringify(data),
        });
        if (!response.ok) throw await failure(response, 'Erro ao criar dentista');
        return response.json();
    },

    async update(id: string, data: DentistInput, clinicId?: string | null): Promise<Dentist> {
        const response = await fetch(`${API_URL}/dentists/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(clinicId),
            body: JSON.stringify(data),
        });
        if (!response.ok) throw await failure(response, 'Erro ao atualizar dentista');
        return response.json();
    },

    async remove(id: string, clinicId?: string | null): Promise<{ deleted?: boolean; deactivated?: boolean }> {
        const response = await fetch(`${API_URL}/dentists/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(clinicId),
        });
        if (!response.ok) throw await failure(response, 'Erro ao excluir dentista');
        return response.json();
    },

    async previewStandardization(id: string, clinicId?: string | null): Promise<StandardizationPreviewResult> {
        const response = await fetch(`${API_URL}/dentists/${id}/standardize/preview`, {
            method: 'POST',
            headers: getAuthHeaders(clinicId),
        });
        if (!response.ok) throw await failure(response, 'Erro ao buscar registros semelhantes');
        return response.json();
    },

    async applyStandardization(
        id: string,
        selection: StandardizationSelection,
        clinicId?: string | null
    ): Promise<StandardizationApplyResult> {
        const response = await fetch(`${API_URL}/dentists/${id}/standardize/apply`, {
            method: 'POST',
            headers: getAuthHeaders(clinicId),
            body: JSON.stringify(selection),
        });
        if (!response.ok) throw await failure(response, 'Erro ao padronizar registros');
        return response.json();
    },
};
