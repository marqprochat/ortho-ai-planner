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
    sendMessage: (nome: string, telefone: string, unidade: string, modelo: string, dataAgendamento: string) =>
        request<{ status: string; error?: string }>('/messages/send', {
            method: 'POST',
            body: JSON.stringify({ nome, telefone, unidade, modelo, data_agendamento: dataAgendamento }),
        }),

    getMessageConfig: () => request<{ delayMs: number; concurrentLimit: number }>('/messages/config'),
};
