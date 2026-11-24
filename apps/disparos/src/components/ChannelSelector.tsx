import { useEffect, useState } from 'react';
import { RefreshCw, Smartphone, Webhook } from 'lucide-react';
import { api } from '../services/api';
import type { Canal, WahaSession } from '../types';

export const WAHA_STATUS_LABELS: Record<string, string> = {
    WORKING: 'Conectada',
    SCAN_QR_CODE: 'Aguardando QR code',
    STARTING: 'Iniciando',
    STOPPED: 'Parada',
    FAILED: 'Falhou',
};

interface Props {
    canal: Canal;
    wahaSession: string;
    onChange: (canal: Canal, wahaSession: string) => void;
    disabled?: boolean;
}

// Escolha do canal de envio: webhook do Botconversa ou uma sessão conectada do Waha.
export default function ChannelSelector({ canal, wahaSession, onChange, disabled }: Props) {
    const [sessions, setSessions] = useState<WahaSession[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const load = () => {
        setLoading(true);
        setError('');
        api.listWahaSessions()
            .then(setSessions)
            .catch(err => { setSessions([]); setError(err.message); })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (canal === 'waha') load();
    }, [canal]);

    // Seleciona automaticamente a primeira sessão conectada se nenhuma estiver escolhida
    useEffect(() => {
        if (canal !== 'waha' || wahaSession) return;
        const first = sessions.find(s => s.status === 'WORKING');
        if (first) onChange('waha', first.name);
    }, [sessions, canal, wahaSession, onChange]);

    const btn = (value: Canal, label: string, Icon: typeof Webhook) => (
        <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(value, value === 'waha' ? wahaSession : '')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all disabled:opacity-50 ${canal === value ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
            <Icon className="w-3.5 h-3.5" />
            {label}
        </button>
    );

    const selectedMissing = Boolean(wahaSession) && !loading && !sessions.some(s => s.name === wahaSession);

    return (
        <div className="flex items-start gap-3 flex-wrap">
            <div className="flex flex-col gap-0.5">
                <label className="text-xs font-medium text-muted-foreground">Enviar por</label>
                <div className="flex items-center bg-muted/60 rounded-lg p-1 gap-1 h-[38px]">
                    {btn('botconversa', 'Botconversa', Webhook)}
                    {btn('waha', 'Conexão Waha', Smartphone)}
                </div>
            </div>

            {canal === 'waha' && (
                <div className="flex flex-col gap-0.5">
                    <label className="text-xs font-medium text-muted-foreground">Conexão (sessão)</label>
                    <div className="flex items-center gap-1.5">
                        <select
                            value={wahaSession}
                            disabled={disabled || loading}
                            onChange={e => onChange('waha', e.target.value)}
                            className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground shadow-sm outline-none cursor-pointer hover:border-primary transition-colors h-[38px] min-w-[220px]"
                        >
                            <option value="">{loading ? 'Carregando...' : 'Selecione a conexão'}</option>
                            {selectedMissing && <option value={wahaSession}>{wahaSession} (não encontrada)</option>}
                            {sessions.map(s => (
                                <option key={s.name} value={s.name} disabled={s.status !== 'WORKING'}>
                                    {s.name}{s.me?.pushName ? ` · ${s.me.pushName}` : ''} — {WAHA_STATUS_LABELS[s.status] || s.status}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={load}
                            disabled={loading}
                            title="Atualizar conexões"
                            className="p-2 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground h-[38px]"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                    {error && <span className="text-[11px] text-red-500">{error}</span>}
                    {!error && !loading && !sessions.some(s => s.status === 'WORKING') && (
                        <span className="text-[11px] text-amber-600">Nenhuma conexão ativa — conecte uma em Configurações.</span>
                    )}
                </div>
            )}
        </div>
    );
}
