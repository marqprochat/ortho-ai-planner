import { getCookie } from '../lib/cookieUtils';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const getAuthHeaders = () => ({
    'Authorization': `Bearer ${getCookie('token')}`,
    'Content-Type': 'application/json',
});

export interface SyncRunItem {
    id: string;
    trigger: 'cron' | 'catchup' | 'manual';
    status: 'running' | 'completed' | 'partial' | 'failed';
    startedAt: string;
    finishedAt: string | null;
    durationMs: number | null;
    fetched: number;
    candidates: number;
    matched: number;
    updated: number;
    unmatched: number;
    easyDentalComplete: boolean;
    errorMessage: string | null;
}

export interface SyncRunsResponse {
    runs: SyncRunItem[];
    running: boolean;
    schedule: string;
}

export const syncRunService = {
    async list(limit = 30): Promise<SyncRunsResponse> {
        const response = await fetch(`${API_URL}/admin/sync-runs?limit=${limit}`, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Falha ao carregar execuções da sincronização');
        return response.json();
    },

    async trigger(): Promise<void> {
        const response = await fetch(`${API_URL}/admin/sync-runs/trigger`, { method: 'POST', headers: getAuthHeaders() });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Falha ao iniciar a sincronização');
        }
    },
};
