import { getCookie } from '../lib/cookieUtils';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const getAuthHeaders = () => {
    const token = getCookie('token');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
};

export interface AuditLogItem {
    id: string;
    tenantId?: string | null;
    clinicId?: string | null;
    userId?: string | null;
    userName?: string | null;
    userEmail?: string | null;
    action: string;
    resource: string;
    resourceId?: string | null;
    details?: any;
    ipAddress?: string | null;
    userAgent?: string | null;
    createdAt: string;
}

export interface AuditFilterParams {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    action?: string;
    resource?: string;
    search?: string;
}

export interface AuditLogResponse {
    data: AuditLogItem[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export interface AuditStatsResponse {
    last24h: {
        total: number;
        logins: number;
        patientActions: number;
    };
}

export const auditService = {
    async getLogs(params: AuditFilterParams = {}): Promise<AuditLogResponse> {
        const query = new URLSearchParams();
        if (params.page) query.append('page', String(params.page));
        if (params.limit) query.append('limit', String(params.limit));
        if (params.startDate) query.append('startDate', params.startDate);
        if (params.endDate) query.append('endDate', params.endDate);
        if (params.action) query.append('action', params.action);
        if (params.resource) query.append('resource', params.resource);
        if (params.search) query.append('search', params.search);

        const response = await fetch(`${API_URL}/admin/audit-logs?${query.toString()}`, {
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            throw new Error('Falha ao carregar logs de auditoria');
        }

        return response.json();
    },

    async getStats(): Promise<AuditStatsResponse> {
        const response = await fetch(`${API_URL}/admin/audit-logs/stats`, {
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            throw new Error('Falha ao carregar estatísticas');
        }

        return response.json();
    },
};
