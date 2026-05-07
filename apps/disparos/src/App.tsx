import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Toaster, toast } from 'sonner';
import { Search, Send, MessageSquare, Wifi, WifiOff, LogOut, Calendar, Building2 } from 'lucide-react';
import { api } from './services/api';
import FilterPanel from './components/FilterPanel';
import MessageTable from './components/MessageTable';
import SendProgressModal from './components/SendProgressModal';
import type { Filters, Agendamento, MessageItem, SendConfig } from './types';

function getFirstName(fullName: string): string {
    return (fullName || '').trim().split(/\s+/)[0] || '';
}

function extractPhone(ag: Agendamento): string {
    return ag.CELULAR || ag.nr_celular || ag.nr_fone || ag.telefone || ag.celular || ag.fone || '';
}

function extractUnit(ag: Agendamento): string {
    return ag.UNIDADE || ag.TX_UNIDADE_ATENDIMENTO || ag.nm_unidade || ag.unidade || '';
}

function extractStatus(ag: Agendamento): string {
    return ag.STATUS || ag.ds_status || ag.status_agendamento || ag.status || '';
}

function extractProvider(ag: Agendamento): string {
    return ag.DENTISTA || ag.nm_prestador || ag.prestador || '';
}


function getTimeSlot(ag: Agendamento): string {
    const hour = ag.INICIO || ag.hr_agendamento || ag.hora || '';
    const h = parseInt(hour.split(':')[0], 10);
    if (isNaN(h)) return '';
    return h < 12 ? 'Manhã' : 'Tarde';
}

const today = new Date();
const defaultFilters: Filters = {
    dtInicio: today.toISOString().split('T')[0],
    dtTermino: today.toISOString().split('T')[0],
    unidades: [],
    agendas: [],
    statusAgendamento: [],
    periodos: [],
    motivo: '',
};

export default function App() {
    const [authenticated, setAuthenticated] = useState(false);
    const [filters, setFilters] = useState<Filters>(defaultFilters);
    const [filterCollapsed, setFilterCollapsed] = useState(false);
    const [unidadeOptions, setUnidadeOptions] = useState<string[]>([]);
    const [rawAgendamentos, setRawAgendamentos] = useState<Agendamento[]>([]);
    const [messages, setMessages] = useState<MessageItem[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [showSendModal, setShowSendModal] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [sendConfig, setSendConfig] = useState<SendConfig>({ delayMs: 1000, concurrentLimit: 5 });
    const [sentCount, setSentCount] = useState(0);
    const [errorCount, setErrorCount] = useState(0);
    const [currentSendName, setCurrentSendName] = useState('');
    const abortRef = useRef(false);

    // Auth: read token from URL or sessionStorage
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get('token');
        if (urlToken) {
            sessionStorage.setItem('auth_token', urlToken);
            window.history.replaceState({}, '', window.location.pathname);
        }
        const token = sessionStorage.getItem('auth_token');
        if (token) {
            setAuthenticated(true);
        }
    }, []);

    // Load unidades and send config
    useEffect(() => {
        if (!authenticated) return;

        api.getUnidades()
            .then(data => {
                const names = (Array.isArray(data) ? data : [])
                    .map((u: any) => u.TX_UNIDADE_ATENDIMENTO || u.nm_unidade || u.nome || u.name || '')
                    .filter(Boolean)
                    .sort();
                setUnidadeOptions(names);
            })
            .catch(err => toast.error('Erro ao carregar unidades: ' + err.message));

        api.getMessageConfig()
            .then(cfg => setSendConfig(cfg))
            .catch(() => {});
    }, [authenticated]);

    // Apply frontend filters
    const filteredMessages = useMemo(() => {
        return messages.filter(msg => {
            const ag = rawAgendamentos.find(a => {
                const aCode = a.ID_AGENDA_ITEM?.toString() || a.cd_paciente?.toString() || '';
                return aCode === msg.codPaciente;
            });
            if (!ag) return true;

            // Agenda filter
            if (filters.agendas.length > 0) {
                const prov = extractProvider(ag);
                if (prov && !filters.agendas.includes(prov)) return false;
            }

            // Status filter
            if (filters.statusAgendamento.length > 0) {
                const st = extractStatus(ag);
                if (st && !filters.statusAgendamento.includes(st)) return false;
            }

            // Period filter
            if (filters.periodos.length > 0) {
                const slot = getTimeSlot(ag);
                if (slot && !filters.periodos.includes(slot)) return false;
            }


            // Motivo filter
            if (filters.motivo) {
                const motivo = ag.ds_motivo || ag.motivo || '';
                if (!motivo.toLowerCase().includes(filters.motivo.toLowerCase())) return false;
            }

            return true;
        });
    }, [messages, rawAgendamentos, filters]);

    // Fetch agendamentos
    const handleSearch = useCallback(async () => {
        if (!filters.dtInicio || !filters.dtTermino) {
            toast.error('Informe as datas de início e término');
            return;
        }

        setLoading(true);
        try {
            const data = await api.getAgendamentos(
                filters.dtInicio,
                filters.dtTermino,
                filters.unidades
            );

            const agendamentos = Array.isArray(data) ? data : [];
            setRawAgendamentos(agendamentos);

            // Deduplicate by patient + phone
            const seen = new Set<string>();
            const msgs: MessageItem[] = [];

            agendamentos.forEach((ag, i) => {
                const phone = extractPhone(ag);
                const fullName = ag.PACIENTE || ag.nm_paciente || ag.paciente || ag.nome || '';
                const code = ag.ID_AGENDA_ITEM?.toString() || ag.cd_paciente?.toString() || '';
                const dataAg = ag.DATA || ag.dt_agendamento || '';
                const horaAg = ag.INICIO || ag.hr_agendamento || ag.hora || '';
                const key = `${phone}-${code}-${dataAg}-${horaAg}`;

                if (seen.has(key)) return;
                seen.add(key);

                const hasPhone = !!phone;
                msgs.push({
                    id: `msg-${i}-${code}`,
                    nome: getFirstName(fullName),
                    nomeCompleto: fullName,
                    telefone: phone,
                    unidade: extractUnit(ag),
                    codPaciente: code,
                    data: dataAg,
                    hora: horaAg,
                    status: hasPhone ? 'pending' : 'error',
                    errorMessage: hasPhone ? undefined : 'Sem telefone',
                });
            });

            setMessages(msgs);
            setSelectedIds(new Set(msgs.filter(m => m.status === 'pending').map(m => m.id)));

            const errCount = msgs.filter(m => m.status === 'error').length;
            toast.success(`${msgs.length} paciente(s) encontrado(s)${errCount > 0 ? ` (${errCount} sem telefone)` : ''}`);
        } catch (err: any) {
            toast.error('Erro ao buscar agendamentos: ' + err.message);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    // Send messages
    const handleSend = useCallback(async () => {
        const toSend = filteredMessages.filter(m => selectedIds.has(m.id) && m.status === 'pending');
        if (toSend.length === 0) {
            toast.error('Nenhuma mensagem selecionada para envio');
            return;
        }

        setIsSending(true);
        setSentCount(0);
        setErrorCount(0);
        abortRef.current = false;

        const { delayMs, concurrentLimit } = sendConfig;

        // Process in batches
        for (let i = 0; i < toSend.length; i += concurrentLimit) {
            if (abortRef.current) break;

            const batch = toSend.slice(i, i + concurrentLimit);

            // Update status to sending
            setMessages(prev => prev.map(m =>
                batch.some(b => b.id === m.id) ? { ...m, status: 'sending' as const } : m
            ));
            setCurrentSendName(batch[0]?.nome || '');

            // Send batch
            const results = await Promise.allSettled(
                batch.map(msg =>
                    api.sendMessage(msg.nome, msg.telefone, msg.unidade)
                        .then(res => ({ id: msg.id, success: res.status === 'sent', error: res.error }))
                        .catch(err => ({ id: msg.id, success: false, error: err.message }))
                )
            );

            // Update statuses
            results.forEach(result => {
                if (result.status === 'fulfilled') {
                    const { id, success, error } = result.value;
                    setMessages(prev => prev.map(m =>
                        m.id === id ? {
                            ...m,
                            status: success ? 'sent' as const : 'error' as const,
                            errorMessage: success ? undefined : (error || 'Falha no envio'),
                            sentAt: success ? new Date().toISOString() : undefined,
                        } : m
                    ));
                    if (success) setSentCount(c => c + 1);
                    else setErrorCount(c => c + 1);
                }
            });

            // Wait delay before next batch
            if (i + concurrentLimit < toSend.length && !abortRef.current) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }

        setCurrentSendName('');
        toast.success('Envio concluído!');
    }, [filteredMessages, selectedIds, sendConfig]);

    // Select/deselect
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        const pendingIds = filteredMessages.filter(m => m.status === 'pending').map(m => m.id);
        const allSelected = pendingIds.every(id => selectedIds.has(id));
        if (allSelected) setSelectedIds(new Set());
        else setSelectedIds(new Set(pendingIds));
    };

    const handleLogout = () => {
        sessionStorage.removeItem('auth_token');
        setAuthenticated(false);
        window.location.href = '/';
    };

    // Not authenticated
    if (!authenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50">
                <div className="glass-card p-8 max-w-sm w-full text-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center mx-auto">
                        <MessageSquare className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-xl font-bold text-foreground">Disparos WhatsApp</h1>
                    <p className="text-sm text-muted-foreground">
                        Acesse pelo <strong>Portal</strong> para autenticar
                    </p>
                    <div className="flex items-center gap-2 justify-center text-red-500 text-sm">
                        <WifiOff className="w-4 h-4" />
                        <span>Não autenticado</span>
                    </div>
                </div>
                <Toaster position="top-right" />
            </div>
        );
    }

    const selectedCount = filteredMessages.filter(m => selectedIds.has(m.id) && m.status === 'pending').length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-teal-50/20">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-border shadow-sm">
                <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center shadow-lg shadow-primary/20">
                            <MessageSquare className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-foreground leading-tight">Disparos WhatsApp</h1>
                            <p className="text-xs text-muted-foreground">Sistema de mensagens para pacientes</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                            <Wifi className="w-3.5 h-3.5" />
                            <span>Conectado</span>
                        </div>
                        <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Sair">
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main */}
            <main className="max-w-[1600px] mx-auto px-6 py-6">
                <div className="flex gap-6">
                    {/* Sidebar Filters */}
                    <div className={`transition-all duration-300 ${filterCollapsed ? 'w-14' : 'w-80'} shrink-0`}>
                        <div className="sticky top-20">
                            <FilterPanel
                                filters={filters}
                                onChange={setFilters}
                                agendamentos={rawAgendamentos}
                                unidadeOptions={unidadeOptions}
                                collapsed={filterCollapsed}
                                onToggleCollapse={() => setFilterCollapsed(!filterCollapsed)}
                            />
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-4">
                        {/* Action bar */}
                        <div className="glass-card px-5 py-4 flex flex-col gap-4 relative z-10">
                            <div className="flex items-center gap-3 flex-wrap">
                                {/* Date Range */}
                                <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 shadow-sm">
                                    <Calendar className="w-4 h-4 text-primary" />
                                    <input
                                        type="date"
                                        className="bg-transparent text-sm outline-none text-foreground"
                                        value={filters.dtInicio}
                                        onChange={e => setFilters({ ...filters, dtInicio: e.target.value })}
                                    />
                                    <span className="text-muted-foreground text-xs font-medium">até</span>
                                    <input
                                        type="date"
                                        className="bg-transparent text-sm outline-none text-foreground"
                                        value={filters.dtTermino}
                                        onChange={e => setFilters({ ...filters, dtTermino: e.target.value })}
                                    />
                                </div>

                                {/* Unidades Dropdown */}
                                <div className="relative group">
                                    <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 shadow-sm cursor-pointer hover:bg-muted/50 transition-colors">
                                        <Building2 className="w-4 h-4 text-secondary" />
                                        <span className="text-sm font-medium">
                                            {filters.unidades.length === 0 
                                                ? 'Selecionar Unidades' 
                                                : `${filters.unidades.length} unidade(s) selecionada(s)`}
                                        </span>
                                    </div>
                                    <div className="absolute top-full left-0 mt-1 w-64 bg-card border border-border rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 p-2 max-h-64 overflow-y-auto">
                                        {unidadeOptions.length === 0 ? (
                                            <p className="text-xs text-muted-foreground italic p-2">Nenhuma unidade disponível</p>
                                        ) : (
                                            <>
                                                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground pb-2 border-b border-border mb-2 px-1">
                                                    <input
                                                        type="checkbox"
                                                        className="filter-checkbox"
                                                        checked={filters.unidades.length === unidadeOptions.length && unidadeOptions.length > 0}
                                                        onChange={() => {
                                                            const all = filters.unidades.length === unidadeOptions.length;
                                                            setFilters({ ...filters, unidades: all ? [] : [...unidadeOptions] });
                                                        }}
                                                    />
                                                    {filters.unidades.length === unidadeOptions.length ? 'Desmarcar todas' : 'Selecionar todas'}
                                                </label>
                                                {unidadeOptions.map(opt => (
                                                    <label key={opt} className="flex items-center gap-2 text-sm p-1.5 hover:bg-muted rounded cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            className="filter-checkbox"
                                                            checked={filters.unidades.includes(opt)}
                                                            onChange={() => {
                                                                const next = filters.unidades.includes(opt) 
                                                                    ? filters.unidades.filter(v => v !== opt) 
                                                                    : [...filters.unidades, opt];
                                                                setFilters({ ...filters, unidades: next });
                                                            }}
                                                        />
                                                        <span className="truncate">{opt}</span>
                                                    </label>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={handleSearch}
                                    disabled={loading}
                                    className="px-5 py-2 rounded-lg bg-gradient-to-r from-secondary to-blue-500 text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg shadow-secondary/20 disabled:opacity-50 h-[38px]"
                                >
                                    {loading ? <Search className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                    Pesquisar
                                </button>
                            </div>

                            <div className="flex items-center gap-3 pt-4 border-t border-border">
                                <button
                                    onClick={() => { setSentCount(0); setErrorCount(0); setShowSendModal(true); }}
                                    disabled={selectedCount === 0 || isSending}
                                    className="px-5 py-2 rounded-lg bg-gradient-to-r from-primary to-emerald-600 text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none h-[38px]"
                                >
                                    <Send className="w-4 h-4" />
                                    Enviar ({selectedCount})
                                </button>
                                {messages.length > 0 && (
                                    <span className="ml-auto text-xs text-muted-foreground">
                                        Mostrando {filteredMessages.length} de {messages.length} pacientes
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Table */}
                        <MessageTable
                            messages={filteredMessages}
                            selectedIds={selectedIds}
                            onToggleSelect={toggleSelect}
                            onSelectAll={selectAll}
                            isSending={isSending}
                        />
                    </div>
                </div>
            </main>

            {/* Send Modal */}
            <SendProgressModal
                open={showSendModal}
                onClose={() => { setShowSendModal(false); setIsSending(false); }}
                onConfirm={handleSend}
                config={sendConfig}
                onConfigChange={setSendConfig}
                totalMessages={selectedCount}
                sentCount={sentCount}
                errorCount={errorCount}
                isSending={isSending}
                currentName={currentSendName}
            />

            <Toaster position="top-right" richColors />
        </div>
    );
}
