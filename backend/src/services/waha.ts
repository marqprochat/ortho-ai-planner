import prisma from '../lib/prisma';

// Cliente da API do Waha (WhatsApp HTTP API — https://waha.devlike.pro).
// A URL e a API key ficam no registro único WahaConfig ("default"), editável
// pela aba Configurações do Disparador. As variáveis de ambiente WAHA_URL e
// WAHA_API_KEY servem de padrão enquanto nada for salvo pela tela.

export const CANAL_BOTCONVERSA = 'botconversa';
export const CANAL_WAHA = 'waha';
export type Canal = typeof CANAL_BOTCONVERSA | typeof CANAL_WAHA;

export function normalizeCanal(value: unknown): Canal {
    return value === CANAL_WAHA ? CANAL_WAHA : CANAL_BOTCONVERSA;
}

export interface WahaSettings {
    baseUrl: string;
    apiKey: string;
}

export interface WahaSession {
    name: string;
    status: string; // STOPPED | STARTING | SCAN_QR_CODE | WORKING | FAILED
    me?: { id?: string; pushName?: string } | null;
}

const REQUEST_TIMEOUT_MS = 20000;

export function normalizeBaseUrl(url: string): string {
    return (url || '').trim().replace(/\/+$/, '').replace(/\/api$/, '');
}

export async function getWahaSettings(): Promise<WahaSettings> {
    const row = await prisma.wahaConfig.findUnique({ where: { id: 'default' } });
    return {
        baseUrl: normalizeBaseUrl(row?.baseUrl || process.env.WAHA_URL || ''),
        apiKey: row?.apiKey || process.env.WAHA_API_KEY || '',
    };
}

export class WahaError extends Error {
    constructor(message: string, public status = 502) {
        super(message);
    }
}

async function wahaFetch(
    settings: WahaSettings,
    path: string,
    init: RequestInit = {},
): Promise<Response> {
    if (!settings.baseUrl) {
        throw new WahaError('Integração Waha não configurada (informe a URL em Configurações)', 400);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        return await fetch(`${settings.baseUrl}${path}`, {
            ...init,
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                ...(settings.apiKey ? { 'X-Api-Key': settings.apiKey } : {}),
                ...(init.headers || {}),
            },
        });
    } catch (err: any) {
        const reason = err?.name === 'AbortError' ? 'tempo esgotado' : err?.message || 'falha de rede';
        throw new WahaError(`Não foi possível conectar ao Waha (${reason})`);
    } finally {
        clearTimeout(timer);
    }
}

async function wahaJson<T>(settings: WahaSettings, path: string, init: RequestInit = {}): Promise<T> {
    const res = await wahaFetch(settings, path, init);
    const text = await res.text().catch(() => '');
    if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
            throw new WahaError('Waha recusou a API key (401/403)', 400);
        }
        throw new WahaError(`Waha retornou ${res.status}: ${text.slice(0, 300)}`, res.status === 404 ? 404 : 502);
    }
    if (!text) return undefined as T;
    try {
        return JSON.parse(text) as T;
    } catch {
        return text as unknown as T;
    }
}

const enc = encodeURIComponent;

export async function listSessions(settings?: WahaSettings): Promise<WahaSession[]> {
    const s = settings || (await getWahaSettings());
    const data = await wahaJson<any[]>(s, '/api/sessions?all=true');
    return (Array.isArray(data) ? data : []).map(d => ({
        name: d.name,
        status: d.status,
        me: d.me ?? null,
    }));
}

export async function createSession(name: string): Promise<void> {
    const s = await getWahaSettings();
    await wahaJson(s, '/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ name, start: true }),
    });
}

export async function sessionAction(name: string, action: 'start' | 'stop' | 'restart' | 'logout'): Promise<void> {
    const s = await getWahaSettings();
    await wahaJson(s, `/api/sessions/${enc(name)}/${action}`, { method: 'POST' });
}

export async function deleteSession(name: string): Promise<void> {
    const s = await getWahaSettings();
    await wahaJson(s, `/api/sessions/${enc(name)}`, { method: 'DELETE' });
}

// QR code para parear a sessão (status SCAN_QR_CODE) — devolvido como data URL.
export async function getSessionQr(name: string): Promise<string> {
    const s = await getWahaSettings();
    const data = await wahaJson<{ mimetype?: string; data?: string }>(
        s,
        `/api/${enc(name)}/auth/qr?format=image`,
    );
    if (!data?.data) throw new WahaError('Waha não retornou o QR code');
    return `data:${data.mimetype || 'image/png'};base64,${data.data}`;
}

// Resolve o chatId real do número (o WhatsApp no Brasil pode ou não usar o 9º dígito).
async function resolveChatId(s: WahaSettings, session: string, phone: string): Promise<string> {
    const digits = phone.replace(/\D/g, '');
    if (!digits) throw new WahaError('Telefone inválido', 400);
    const res = await wahaJson<{ numberExists?: boolean; chatId?: string }>(
        s,
        `/api/contacts/check-exists?phone=${enc(digits)}&session=${enc(session)}`,
    ).catch(err => {
        // Versões antigas do Waha não têm o endpoint: cai para o número como está.
        if (err instanceof WahaError && err.status === 404) return null;
        throw err;
    });
    if (res && res.numberExists === false) {
        throw new WahaError('Número não possui WhatsApp', 400);
    }
    return res?.chatId || `${digits}@c.us`;
}

export async function sendText(session: string, phone: string, text: string, settings?: WahaSettings): Promise<void> {
    if (!session) throw new WahaError('Sessão Waha não informada', 400);
    if (!text.trim()) throw new WahaError('Modelo sem texto para envio pelo Waha (preencha em Mensagens)', 400);
    const s = settings || (await getWahaSettings());
    const chatId = await resolveChatId(s, session, phone);
    await wahaJson(s, '/api/sendText', {
        method: 'POST',
        body: JSON.stringify({ session, chatId, text }),
    });
}

// Substitui {{variavel}} pelos campos do payload (mesmos nomes enviados ao Botconversa).
export function renderTemplate(template: string, vars: Record<string, unknown>): string {
    return (template || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
        const v = vars[key];
        return v === undefined || v === null ? '' : String(v);
    });
}

// Texto do modelo de mensagem usado no envio pelo Waha, buscado pelo código do modelo.
export async function getTemplateText(modelo: string): Promise<string> {
    if (!modelo) return '';
    const tpl = await prisma.messageTemplate.findUnique({ where: { code: modelo } });
    return tpl?.wahaText || '';
}
