import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import {
    WahaError,
    createSession,
    deleteSession,
    getSessionQr,
    getWahaSettings,
    listSessions,
    normalizeBaseUrl,
    sessionAction,
} from '../services/waha';

function handleError(res: Response, error: any) {
    const status = error instanceof WahaError ? error.status : 500;
    res.status(status).json({ error: error?.message || 'Erro na integração Waha' });
}

function maskKey(key: string): string {
    if (!key) return '';
    return key.length <= 4 ? '••••' : `••••${key.slice(-4)}`;
}

// A API key nunca volta inteira para o navegador.
export const getWahaConfig = async (_req: Request, res: Response) => {
    try {
        const s = await getWahaSettings();
        res.json({ baseUrl: s.baseUrl, hasApiKey: Boolean(s.apiKey), apiKeyMasked: maskKey(s.apiKey) });
    } catch (error: any) {
        handleError(res, error);
    }
};

export const updateWahaConfig = async (req: Request, res: Response) => {
    try {
        const { baseUrl, apiKey } = req.body as { baseUrl?: string; apiKey?: string };
        const url = normalizeBaseUrl(baseUrl || '');
        if (url && !/^https?:\/\/[^\s]+$/i.test(url)) {
            return res.status(400).json({ error: 'URL inválida — use http:// ou https://' });
        }
        // apiKey ausente/undefined mantém a atual; string vazia remove.
        await prisma.wahaConfig.upsert({
            where: { id: 'default' },
            create: { id: 'default', baseUrl: url, apiKey: apiKey ?? '' },
            update: { baseUrl: url, ...(apiKey !== undefined && { apiKey }) },
        });
        const s = await getWahaSettings();
        res.json({ baseUrl: s.baseUrl, hasApiKey: Boolean(s.apiKey), apiKeyMasked: maskKey(s.apiKey) });
    } catch (error: any) {
        handleError(res, error);
    }
};

export const testWahaConnection = async (_req: Request, res: Response) => {
    try {
        const sessions = await listSessions();
        res.json({ ok: true, sessions: sessions.length });
    } catch (error: any) {
        handleError(res, error);
    }
};

export const listWahaSessions = async (_req: Request, res: Response) => {
    try {
        res.json(await listSessions());
    } catch (error: any) {
        handleError(res, error);
    }
};

const SESSION_NAME = /^[A-Za-z0-9_-]{1,50}$/;

export const createWahaSession = async (req: Request, res: Response) => {
    try {
        const name = String(req.body?.name || '').trim();
        if (!SESSION_NAME.test(name)) {
            return res.status(400).json({ error: 'Nome da sessão: use letras, números, "-" ou "_" (até 50)' });
        }
        await createSession(name);
        res.status(201).json({ ok: true });
    } catch (error: any) {
        handleError(res, error);
    }
};

const ACTIONS = ['start', 'stop', 'restart', 'logout'] as const;

export const wahaSessionAction = async (req: Request, res: Response) => {
    try {
        const { name, action } = req.params;
        if (!ACTIONS.includes(action as any)) {
            return res.status(400).json({ error: 'Ação inválida' });
        }
        await sessionAction(name, action as (typeof ACTIONS)[number]);
        res.json({ ok: true });
    } catch (error: any) {
        handleError(res, error);
    }
};

export const deleteWahaSession = async (req: Request, res: Response) => {
    try {
        await deleteSession(req.params.name);
        res.json({ ok: true });
    } catch (error: any) {
        handleError(res, error);
    }
};

export const getWahaSessionQr = async (req: Request, res: Response) => {
    try {
        res.json({ qr: await getSessionQr(req.params.name) });
    } catch (error: any) {
        handleError(res, error);
    }
};
