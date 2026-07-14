import type { MessageTemplate } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || '';
const API_URL = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;

function getToken(): string | null {
    return sessionStorage.getItem('auth_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = getToken();
    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {}),
        },
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `Request failed: ${res.status}`);
    }

    return res.json();
}

export async function login(email: string, password: string): Promise<{ token: string; user: any }> {
    const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Falha no login');
    }
    return res.json();
}

export async function getMe(token: string): Promise<{ user: any }> {
    const res = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Falha ao verificar usuário');
    }
    return res.json();
}

// EasyDental
export const api = {
    getUnidades: () => request<any[]>('/easydental/unidades'),

    getAgendamentos: (dtInicio: string, dtTermino: string, unidades: string[]) =>
        request<any[]>('/easydental/agendamentos', {
            method: 'POST',
            body: JSON.stringify({ dt_inicio: dtInicio, dt_termino: dtTermino, unidades }),
        }),

    getKPI: (dtInicio: string, dtTermino: string, nmUnidade?: string, nmPrestador?: string) =>
        request<any>('/easydental/kpi', {
            method: 'POST',
            body: JSON.stringify({ dt_inicio: dtInicio, dt_termino: dtTermino, nm_unidade: nmUnidade, nm_prestador: nmPrestador }),
        }),

    getPrestador: (cpf: string) =>
        request<any>('/easydental/prestador', {
            method: 'POST',
            body: JSON.stringify({ cpf }),
        }),

    // Messages
    sendMessage: (nome: string, telefone: string, unidade: string, modelo: string, dataAgendamento: string, extraData?: any) =>
        request<{ status: string; error?: string }>('/messages/send', {
            method: 'POST',
            body: JSON.stringify({ nome, telefone, unidade, modelo, data_agendamento: dataAgendamento, ...(extraData || {}) }),
        }),

    getMessageConfig: () => request<{ delayMs: number; concurrentLimit: number }>('/messages/config'),

    // Scheduled Disparos
    listScheduledDisparos: () => request<any[]>('/scheduled-disparos'),

    getScheduledDisparo: (id: string) => request<any>(`/scheduled-disparos/${id}`),

    createScheduledDisparo: (data: any) =>
        request<any>('/scheduled-disparos', { method: 'POST', body: JSON.stringify(data) }),

    updateScheduledDisparo: (id: string, data: any) =>
        request<any>(`/scheduled-disparos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    deleteScheduledDisparo: (id: string) =>
        request<any>(`/scheduled-disparos/${id}`, { method: 'DELETE' }),

    triggerScheduledDisparo: (id: string) =>
        request<any>(`/scheduled-disparos/${id}/trigger`, { method: 'POST' }),

    getScheduledDisparoLogs: (id: string) =>
        request<any[]>(`/scheduled-disparos/${id}/logs`),

    getDisparoReports: (dtInicio?: string, dtTermino?: string) => {
        const params = new URLSearchParams();
        if (dtInicio) params.set('dtInicio', dtInicio);
        if (dtTermino) params.set('dtTermino', dtTermino);
        return request<any[]>(`/scheduled-disparos/reports?${params.toString()}`);
    },

    getUltimaConsulta: (dtInicio: string, dtTermino: string, unidades: string[]) =>
        request<{ success: boolean; data: any[] }>('/easydental/ultima-consulta', {
            method: 'POST',
            body: JSON.stringify({ dt_inicio: dtInicio, dt_termino: dtTermino, unidades }),
        }),

    getAniversarios: (dtInicio: string, dtTermino: string, unidades: string[]) =>
        request<{ success: boolean; data: any[] }>('/easydental/aniversarios', {
            method: 'POST',
            body: JSON.stringify({ dt_inicio: dtInicio, dt_termino: dtTermino, unidades }),
        }),

    // Message Templates
    listMessageTemplates: () => request<MessageTemplate[]>('/message-templates'),
    createMessageTemplate: (data: Partial<MessageTemplate>) =>
        request<MessageTemplate>('/message-templates', { method: 'POST', body: JSON.stringify(data) }),
    updateMessageTemplate: (id: string, data: Partial<MessageTemplate>) =>
        request<MessageTemplate>(`/message-templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteMessageTemplate: (id: string) =>
        request<{ success: boolean }>(`/message-templates/${id}`, { method: 'DELETE' }),
};
