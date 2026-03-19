import { getCookie } from '../lib/cookieUtils';

const API_URL = import.meta.env.VITE_API_URL || '/api';

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

export interface ReportFilter {
    search?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    isSigned?: boolean;
}

export const reportService = {
    async getPatientsReport(filters: ReportFilter = {}): Promise<any[]> {
        const query = new URLSearchParams();
        if (filters.search) query.append('search', filters.search);
        if (filters.startDate) query.append('startDate', filters.startDate);
        if (filters.endDate) query.append('endDate', filters.endDate);

        const response = await fetch(`${API_URL}/reports/patients?${query.toString()}`, {
            headers: getAuthHeaders(),
        });

        if (!response.ok) throw new Error('Erro ao buscar relatório de pacientes');
        return response.json();
    },

    async getPlanningsReport(filters: ReportFilter = {}): Promise<any[]> {
        const query = new URLSearchParams();
        if (filters.status) query.append('status', filters.status);
        if (filters.search) query.append('search', filters.search);
        if (filters.startDate) query.append('startDate', filters.startDate);
        if (filters.endDate) query.append('endDate', filters.endDate);

        const response = await fetch(`${API_URL}/reports/plannings?${query.toString()}`, {
            headers: getAuthHeaders(),
        });

        if (!response.ok) throw new Error('Erro ao buscar relatório de planejamentos');
        return response.json();
    },

    async getContractsReport(filters: ReportFilter = {}): Promise<any[]> {
        const query = new URLSearchParams();
        if (filters.isSigned !== undefined) query.append('isSigned', String(filters.isSigned));
        if (filters.search) query.append('search', filters.search);
        if (filters.startDate) query.append('startDate', filters.startDate);
        if (filters.endDate) query.append('endDate', filters.endDate);

        const response = await fetch(`${API_URL}/reports/contracts?${query.toString()}`, {
            headers: getAuthHeaders(),
        });

        if (!response.ok) throw new Error('Erro ao buscar relatório de contratos');
        return response.json();
    },

    async getTreatmentsReport(filters: ReportFilter = {}): Promise<any[]> {
        const query = new URLSearchParams();
        if (filters.status) query.append('status', filters.status);
        if (filters.search) query.append('search', filters.search);
        if (filters.startDate) query.append('startDate', filters.startDate);
        if (filters.endDate) query.append('endDate', filters.endDate);

        const response = await fetch(`${API_URL}/reports/treatments?${query.toString()}`, {
            headers: getAuthHeaders(),
        });

        if (!response.ok) throw new Error('Erro ao buscar relatório de tratamentos');
        return response.json();
    }
};
