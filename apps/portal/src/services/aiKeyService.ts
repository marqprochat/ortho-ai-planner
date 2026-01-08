import { authService } from './authService';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export interface AiApiKey {
    id: string;
    provider: string;
    key: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

const getHeaders = () => {
    const token = authService.getToken();
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
};

export const getAiKeys = async (): Promise<AiApiKey[]> => {
    const response = await fetch(`${API_URL}/ai-keys`, {
        headers: getHeaders(),
    });

    if (!response.ok) {
        throw new Error('Falha ao buscar chaves');
    }

    return response.json();
};

export const createAiKey = async (provider: string, key: string): Promise<AiApiKey> => {
    const response = await fetch(`${API_URL}/ai-keys`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ provider, key }),
    });

    if (!response.ok) {
        throw new Error('Falha ao criar chave');
    }

    return response.json();
};

export const updateAiKey = async (id: string, key: string, isActive: boolean): Promise<AiApiKey> => {
    const response = await fetch(`${API_URL}/ai-keys/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ key, isActive }),
    });

    if (!response.ok) {
        throw new Error('Falha ao atualizar chave');
    }

    return response.json();
};

export const deleteAiKey = async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/ai-keys/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
    });

    if (!response.ok) {
        throw new Error('Falha ao deletar chave');
    }
};
