import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
    CheckCircle, Loader2, LogOut, Play, Plug, Plus, QrCode, RefreshCw, Save, Smartphone, Square, Trash2, X,
} from 'lucide-react';
import { api } from '../services/api';
import type { WahaConfig, WahaSession } from '../types';
import { WAHA_STATUS_LABELS } from './ChannelSelector';

const STATUS_STYLE: Record<string, string> = {
    WORKING: 'bg-emerald-100 text-emerald-700',
    SCAN_QR_CODE: 'bg-amber-100 text-amber-700',
    STARTING: 'bg-blue-100 text-blue-700',
    STOPPED: 'bg-slate-100 text-slate-600',
    FAILED: 'bg-red-100 text-red-700',
};

function QrModal({ session, onClose }: { session: string; onClose: () => void }) {
    const [qr, setQr] = useState('');
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');

    // Atualiza o QR (expira em ~20s) e fecha sozinho quando a sessão conecta
    useEffect(() => {
        let cancelled = false;
        const tick = async () => {
            try {
                const sessions = await api.listWahaSessions();
                const s = sessions.find(x => x.name === session);
                if (cancelled) return;
                setStatus(s?.status || '');
                if (s?.status === 'WORKING') {
                    toast.success(`Conexão "${session}" ativa!`);
                    onClose();
                    return;
                }
                if (s?.status === 'SCAN_QR_CODE') {
                    const { qr } = await api.getWahaSessionQr(session);
                    if (!cancelled) { setQr(qr); setError(''); }
                }
            } catch (err: any) {
                if (!cancelled) setError(err.message);
            }
        };
        tick();
        const id = setInterval(tick, 5000);
        return () => { cancelled = true; clearInterval(id); };
    }, [session, onClose]);

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
            <div className="glass-card bg-white p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                        <QrCode className="w-4 h-4 text-primary" /> Conectar "{session}"
                    </h3>
                    <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
                </div>
                <p className="text-xs text-muted-foreground">
                    No celular: WhatsApp → Aparelhos conectados → Conectar aparelho, e leia o código abaixo.
                </p>
                <div className="aspect-square w-full bg-muted/40 rounded-xl flex items-center justify-center overflow-hidden">
                    {qr ? <img src={qr} alt="QR code do WhatsApp" className="w-full h-full object-contain" />
                        : <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />}
                </div>
                <p className="text-xs text-center text-muted-foreground">
                    Status: {WAHA_STATUS_LABELS[status] || status || '—'}
                </p>
                {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
        </div>
    );
}

export default function WahaSettingsTab() {
    const [config, setConfig] = useState<WahaConfig | null>(null);
    const [baseUrl, setBaseUrl] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

    const [sessions, setSessions] = useState<WahaSession[]>([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [sessionsError, setSessionsError] = useState('');
    const [newName, setNewName] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const [qrSession, setQrSession] = useState<string | null>(null);

    const loadSessions = useCallback(() => {
        setSessionsLoading(true);
        setSessionsError('');
        api.listWahaSessions()
            .then(setSessions)
            .catch(err => { setSessions([]); setSessionsError(err.message); })
            .finally(() => setSessionsLoading(false));
    }, []);

    useEffect(() => {
        api.getWahaConfig()
            .then(cfg => {
                setConfig(cfg);
                setBaseUrl(cfg.baseUrl);
                if (cfg.baseUrl) loadSessions();
            })
            .catch(err => toast.error('Erro ao carregar configuração do Waha: ' + err.message));
    }, [loadSessions]);

    const closeQr = useCallback(() => { setQrSession(null); loadSessions(); }, [loadSessions]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const cfg = await api.updateWahaConfig({ baseUrl, ...(apiKey ? { apiKey } : {}) });
            setConfig(cfg);
            setApiKey('');
            toast.success('Configuração do Waha salva');
            loadSessions();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveKey = async () => {
        try {
            setConfig(await api.updateWahaConfig({ baseUrl, apiKey: '' }));
            toast.success('API key removida');
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const handleTest = async () => {
        setTesting(true);
        try {
            const r = await api.testWaha();
            toast.success(`Waha respondeu — ${r.sessions} conexão(ões) encontrada(s)`);
            loadSessions();
        } catch (err: any) {
            toast.error('Falha na conexão: ' + err.message);
        } finally {
            setTesting(false);
        }
    };

    const runAction = async (name: string, fn: () => Promise<unknown>, okMsg: string): Promise<boolean> => {
        setBusy(name);
        try {
            await fn();
            toast.success(okMsg);
            loadSessions();
            return true;
        } catch (err: any) {
            toast.error(err.message);
            return false;
        } finally {
            setBusy(null);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const name = newName.trim();
        if (!/^[A-Za-z0-9_-]{1,50}$/.test(name)) {
            toast.error('Use apenas letras, números, "-" ou "_" no nome da conexão');
            return;
        }
        if (await runAction(name, () => api.createWahaSession(name), `Conexão "${name}" criada`)) {
            setNewName('');
            setQrSession(name);
        }
    };

    const inputCls = 'w-full px-3 py-2 text-sm border border-border rounded-lg bg-background outline-none focus:border-primary';
    const iconBtn = 'p-2 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40';

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h2 className="text-lg font-bold text-foreground">Configurações</h2>
                <p className="text-sm text-muted-foreground">Integração direta com o Waha para enviar mensagens por várias conexões de WhatsApp.</p>
            </div>

            {/* Dados da integração */}
            <form onSubmit={handleSave} className="glass-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                    <Plug className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-foreground">Integração Waha</h3>
                    {config?.baseUrl && (
                        <span className="ml-auto text-xs text-emerald-600 flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Configurado
                        </span>
                    )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-foreground">URL do servidor Waha *</label>
                        <input
                            required
                            type="url"
                            className={inputCls}
                            value={baseUrl}
                            onChange={e => setBaseUrl(e.target.value)}
                            placeholder="https://waha.suaempresa.com.br"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-foreground">API key (X-Api-Key)</label>
                        <input
                            type="password"
                            autoComplete="off"
                            className={inputCls}
                            value={apiKey}
                            onChange={e => setApiKey(e.target.value)}
                            placeholder={config?.hasApiKey ? `Salva (${config.apiKeyMasked}) — deixe vazio para manter` : 'Opcional'}
                        />
                        {config?.hasApiKey && (
                            <button type="button" onClick={handleRemoveKey} className="text-[11px] text-red-500 hover:underline">
                                Remover API key salva
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={handleTest}
                        disabled={testing || !config?.baseUrl}
                        className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
                        Testar conexão
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-5 py-2 rounded-lg bg-gradient-to-r from-primary to-emerald-600 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salvar
                    </button>
                </div>
            </form>

            {/* Sessões */}
            <div className="glass-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-foreground">Conexões de WhatsApp (sessões)</h3>
                    <button onClick={loadSessions} disabled={sessionsLoading || !config?.baseUrl} className={`ml-auto ${iconBtn}`} title="Atualizar">
                        <RefreshCw className={`w-4 h-4 ${sessionsLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {!config?.baseUrl ? (
                    <p className="text-sm text-muted-foreground italic">Salve a URL do Waha para gerenciar as conexões.</p>
                ) : (
                    <>
                        <form onSubmit={handleCreate} className="flex items-center gap-2">
                            <input
                                className={inputCls}
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                placeholder="Nome da nova conexão (ex: unidade-centro)"
                            />
                            <button
                                type="submit"
                                disabled={!newName.trim() || busy !== null}
                                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                            >
                                <Plus className="w-4 h-4" /> Nova conexão
                            </button>
                        </form>

                        {sessionsError && <p className="text-sm text-red-500">{sessionsError}</p>}

                        {sessions.length === 0 && !sessionsLoading && !sessionsError ? (
                            <p className="text-sm text-muted-foreground italic">Nenhuma conexão criada no Waha.</p>
                        ) : (
                            <div className="divide-y divide-border">
                                {sessions.map(s => {
                                    const isBusy = busy === s.name;
                                    return (
                                        <div key={s.name} className="py-3 flex items-center gap-3 flex-wrap">
                                            <div className="min-w-0 flex-1">
                                                <p className="font-medium text-foreground truncate">{s.name}</p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {s.me?.pushName || 'Sem número vinculado'}
                                                    {s.me?.id ? ` · ${s.me.id.replace(/@.*/, '')}` : ''}
                                                </p>
                                            </div>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[s.status] || 'bg-slate-100 text-slate-600'}`}>
                                                {WAHA_STATUS_LABELS[s.status] || s.status}
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                {isBusy && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                                                {s.status === 'SCAN_QR_CODE' && (
                                                    <button className={iconBtn} title="Ler QR code" onClick={() => setQrSession(s.name)}>
                                                        <QrCode className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {(s.status === 'STOPPED' || s.status === 'FAILED') && (
                                                    <button className={iconBtn} title="Iniciar" disabled={isBusy}
                                                        onClick={() => runAction(s.name, () => api.wahaSessionAction(s.name, 'start'), 'Conexão iniciada')}>
                                                        <Play className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {s.status !== 'STOPPED' && (
                                                    <button className={iconBtn} title="Parar" disabled={isBusy}
                                                        onClick={() => runAction(s.name, () => api.wahaSessionAction(s.name, 'stop'), 'Conexão parada')}>
                                                        <Square className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {s.status === 'WORKING' && (
                                                    <button className={iconBtn} title="Desconectar número" disabled={isBusy}
                                                        onClick={() => {
                                                            if (confirm(`Desconectar o WhatsApp da conexão "${s.name}"? Será preciso ler o QR code de novo.`)) {
                                                                runAction(s.name, () => api.wahaSessionAction(s.name, 'logout'), 'Número desconectado');
                                                            }
                                                        }}>
                                                        <LogOut className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button className={`${iconBtn} hover:text-red-600`} title="Excluir conexão" disabled={isBusy}
                                                    onClick={() => {
                                                        if (confirm(`Excluir a conexão "${s.name}" do Waha? Essa ação não pode ser desfeita.`)) {
                                                            runAction(s.name, () => api.deleteWahaSession(s.name), 'Conexão excluída');
                                                        }
                                                    }}>
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>

            {qrSession && <QrModal session={qrSession} onClose={closeQr} />}
        </div>
    );
}
