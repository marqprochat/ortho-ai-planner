import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Toaster, toast } from 'sonner';
import { Search, Send, Wifi, WifiOff, LogOut, Calendar, Building2, Clock, Lock, BarChart3, Settings2 } from 'lucide-react';
import { api, login, getMe } from './services/api';
import FilterPanel from './components/FilterPanel';
import MessageTable from './components/MessageTable';
import SendProgressModal from './components/SendProgressModal';
import ScheduledDisparos from './components/ScheduledDisparos';
import DisparoReports from './components/DisparoReports';
import MessageTemplatesTab from './components/MessageTemplatesTab';
import DentalConnectIcon from './components/DentalConnectIcon';
import type { Filters, Agendamento, MessageItem, SendConfig, MessageTemplate } from './types';

type Tab = 'manual' | 'agendados' | 'relatorios' | 'mensagens';

function getFirstName(fullName: string): string {
    return (fullName || '').trim().split(/\s+/)[0] || '';
}

function extractPhone(ag: Agendamento): string {
    const raw = (ag.CELULAR || ag.nr_celular || ag.nr_fone || ag.telefone || ag.celular || ag.fone || ag.nr_fone_celular || ag.celular_paciente || '').toString();
    if (!raw) return '';
    let digits = raw.replace(/\D/g, '');
    if (!digits) return '';

    // Remove leading zero if present and it's not a 55 prefix already
    if (digits.length >= 11 && digits.startsWith('0')) {
        digits = digits.substring(1);
    }

    if (digits.startsWith('55') && digits.length >= 12) {
        return `+${digits}`;
    }
    return `+55${digits}`;
}

function extractUnit(ag: Agendamento): string {
    return ag.UNIDADE || ag.TX_UNIDADE_ATENDIMENTO || ag.nm_unidade || ag.unidade || ag.NM_UNIDADE_ATENDIMENTO || '';
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

function formatAgendamento(data: string, hora: string): string {
    if (!data || !hora) return '';

    let dateObj: Date;
    let formattedDate = data;

    if (data.includes('-')) {
        const [y, m, d] = data.split('-');
        dateObj = new Date(Number(y), Number(m) - 1, Number(d));
        formattedDate = `${d}/${m}/${y}`;
    } else if (data.includes('/')) {
        const [d, m, y] = data.split('/');
        dateObj = new Date(Number(y), Number(m) - 1, Number(d));
        formattedDate = `${d}/${m}/${y}`;
    } else {
        return `${data} ás ${hora}`;
    }

    const daysOfWeek = [
        'domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
        'quinta-feira', 'sexta-feira', 'sábado'
    ];
    const dayName = daysOfWeek[dateObj.getDay()];

    return `${dayName} ${formattedDate} às ${hora}`;
}

function dateOffset(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

// Default model is "Confirmação de Consulta" → tomorrow
const defaultFilters: Filters = {
    dtInicio: dateOffset(1),
    dtTermino: dateOffset(1),
    unidades: [],
    agendas: [],
    statusAgendamento: [],
    periodos: [],
    motivo: '',
};

const FALLBACK_PRESETS: Record<string, { name: string; dayOffset: number; statusKeyword: string }> = {
    '22180': { name: 'Confirmação de Consulta', dayOffset: 1, statusKeyword: 'agenda' },
    '19872': { name: 'Avaliação', dayOffset: -1, statusKeyword: 'atend' }
};

export default function App() {
    const [authenticated, setAuthenticated] = useState(false);
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);
    const [loginError, setLoginError] = useState('');
    const [activeTab, setActiveTab] = useState<Tab>('manual');
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
    const [selectedModel, setSelectedModel] = useState('22180');
    const [totalToProcess, setTotalToProcess] = useState(0);
    const abortRef = useRef(false);

    const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(true);

    const [isUltimaConsulta, setIsUltimaConsulta] = useState(false);
    const [onlyWithoutScheduled, setOnlyWithoutScheduled] = useState(false);

    const currentPreset = useMemo(() => {
        const dbTpl = messageTemplates.find(t => t.code === selectedModel);
        if (dbTpl) {
            return {
                label: dbTpl.name,
                dayOffset: dbTpl.dayOffset,
                statusKeyword: dbTpl.statusKeyword,
                hint: `${dbTpl.dayOffset === 0 ? 'Hoje' : dbTpl.dayOffset > 0 ? `Amanhã (+${dbTpl.dayOffset}d)` : `Ontem (${dbTpl.dayOffset}d)`}${dbTpl.statusKeyword ? ` · Status: ${dbTpl.statusKeyword}` : ''}`
            };
        }
        const fb = FALLBACK_PRESETS[selectedModel];
        if (fb) {
            return {
                label: fb.name,
                dayOffset: fb.dayOffset,
                statusKeyword: fb.statusKeyword,
                hint: `${fb.dayOffset === 1 ? 'Amanhã' : fb.dayOffset === -1 ? 'Ontem' : 'Hoje'} · Status: ${fb.statusKeyword}`
            };
        }
        return null;
    }, [messageTemplates, selectedModel]);

    // Auth: read token from URL or sessionStorage, then verify with backend
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get('token');
        if (urlToken) {
            sessionStorage.setItem('auth_token', urlToken);
            window.history.replaceState({}, '', window.location.pathname);
        }
        const token = sessionStorage.getItem('auth_token');
        if (!token) return;

        getMe(token)
            .then(({ user }) => {
                const hasAccess = user.isSuperAdmin ||
                    user.appAccess?.some((a: any) => a.application?.name === 'disparos');
                if (hasAccess) {
                    setAuthenticated(true);
                } else {
                    sessionStorage.removeItem('auth_token');
                    setLoginError('Seu usuário não tem permissão para acessar o Dental Connect. Solicite ao administrador.');
                }
            })
            .catch(() => {
                // Token expirado ou inválido — limpa e mostra login
                sessionStorage.removeItem('auth_token');
            });
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
            .catch(() => { });
    }, [authenticated]);

    // Load Message Templates
    useEffect(() => {
        if (!authenticated) return;
        api.listMessageTemplates()
            .then(data => {
                setMessageTemplates(data);
                if (data.length > 0 && !data.some(t => t.code === selectedModel)) {
                    setSelectedModel(data[0].code);
                }
                setTemplatesLoading(false);
            })
            .catch(err => {
                toast.error('Erro ao carregar modelos: ' + err.message);
                setTemplatesLoading(false);
            });
    }, [authenticated, activeTab]);

    // Apply frontend filters
    const filteredMessages = useMemo(() => {
        return messages.filter(msg => {
            if (isUltimaConsulta) {
                if (onlyWithoutScheduled && msg.consultaAgendada) {
                    return false;
                }
                return true;
            }

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
    }, [messages, rawAgendamentos, filters, isUltimaConsulta, onlyWithoutScheduled]);

    // Fetch agendamentos
    const handleSearch = useCallback(async () => {
        if (!filters.dtInicio || !filters.dtTermino) {
            toast.error('Informe as datas de início e término');
            return;
        }

        setLoading(true);
        try {
            if (isUltimaConsulta) {
                const res = await api.getUltimaConsulta(
                    filters.dtInicio,
                    filters.dtTermino,
                    filters.unidades
                );

                const records = res.success && Array.isArray(res.data) ? res.data : [];
                setRawAgendamentos([]); // empty in this mode

                const seen = new Set<string>();
                const msgs: MessageItem[] = [];

                records.forEach((rec, i) => {
                    // Extract phone number digits
                    let phone = (rec.CELULAR || '').toString().replace(/\D/g, '');
                    if (phone.length >= 11 && phone.startsWith('0')) {
                        phone = phone.substring(1);
                    }
                    const hasPhone = !!phone;
                    const formattedPhone = hasPhone ? (phone.startsWith('55') ? `+${phone}` : `+55${phone}`) : '';

                    const fullName = rec.PACIENTE || '';
                    const code = rec.CODIGO?.toString() || '';
                    const key = `${formattedPhone}-${code}`;

                    if (seen.has(key)) return;
                    seen.add(key);

                    msgs.push({
                        id: `msg-${i}-${code}`,
                        nome: getFirstName(fullName),
                        nomeCompleto: fullName,
                        telefone: formattedPhone,
                        unidade: rec.UNIDADE || '',
                        codPaciente: code,
                        data: rec.ULTIMA_CONSULTA || '',
                        hora: rec.CONSULTA_AGENDADA || '',
                        ultimaConsulta: rec.ULTIMA_CONSULTA || '',
                        consultaAgendada: rec.CONSULTA_AGENDADA || null,
                        status: hasPhone ? 'pending' : 'error',
                        errorMessage: hasPhone ? undefined : 'Sem telefone',
                    });
                });

                setMessages(msgs);
                setSelectedIds(new Set(msgs.filter(m => m.status === 'pending').map(m => m.id)));

                const errCount = msgs.filter(m => m.status === 'error').length;
                toast.success(`${msgs.length} paciente(s) encontrado(s)${errCount > 0 ? ` (${errCount} sem telefone)` : ''}`);
            } else {
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
                    const dataAg = ag.DATA || ag.dt_agendamento || ag.data || ag.dt_agenda || '';
                    const horaAg = ag.INICIO || ag.hr_agendamento || ag.hora || ag.hr_agenda || '';
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
                        dentista: extractProvider(ag),
                        motivo: ag.MOTIVO || ag.ds_motivo || ag.motivo || '',
                        statusAgendamento: extractStatus(ag),
                        idAgendaItem: ag.ID_AGENDA_ITEM?.toString() || '',
                        txCodigoPaciente: ag.TX_CODIGO_PACIENTE?.toString() || ag.cd_paciente?.toString() || ''
                    });
                });

                setMessages(msgs);
                setSelectedIds(new Set(msgs.filter(m => m.status === 'pending').map(m => m.id)));

                // Auto-select statuses matching the chosen model
                const preset = currentPreset;
                if (preset) {
                    const uniqueStatuses = Array.from(new Set(
                        agendamentos.map(a => a.STATUS || a.ds_status || a.status_agendamento || a.status).filter(Boolean) as string[]
                    ));
                    const matching = uniqueStatuses.filter(s => new RegExp(preset.statusKeyword, 'i').test(s));
                    if (matching.length > 0) {
                        setFilters(prev => ({ ...prev, statusAgendamento: matching }));
                    }
                }

                const errCount = msgs.filter(m => m.status === 'error').length;
                toast.success(`${msgs.length} paciente(s) encontrado(s)${errCount > 0 ? ` (${errCount} sem telefone)` : ''}`);
            }
        } catch (err: any) {
            toast.error('Erro ao buscar agendamentos: ' + err.message);
        } finally {
            setLoading(false);
        }
    }, [filters, selectedModel, isUltimaConsulta]);

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
        setTotalToProcess(toSend.length);
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
                batch.map(msg => {
                    const formattedDate = isUltimaConsulta ? '' : formatAgendamento(msg.data, msg.hora);
                    return api.sendMessage(msg.nome, msg.telefone, msg.unidade, selectedModel, formattedDate, {
                        dentista: msg.dentista || '',
                        motivo: msg.motivo || '',
                        status: msg.statusAgendamento || '',
                        id_agenda_item: msg.idAgendaItem || '',
                        tx_codigo_paciente: msg.txCodigoPaciente || msg.codPaciente || '',
                        paciente: msg.nomeCompleto,
                        celular: msg.telefone,
                        data: isUltimaConsulta ? (msg.ultimaConsulta || '') : (msg.data || ''),
                        inicio: isUltimaConsulta ? '' : (msg.hora || '')
                    })
                        .then(res => ({ id: msg.id, success: res.status === 'sent', error: res.error }))
                        .catch(err => ({ id: msg.id, success: false, error: err.message }));
                })
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
        setIsSending(false);
        toast.success('Envio concluído!');
    }, [filteredMessages, selectedIds, sendConfig, selectedModel, isUltimaConsulta]);

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

    const handleModelChange = useCallback((newModel: string) => {
        setSelectedModel(newModel);
        const tpl = messageTemplates.find(t => t.code === newModel);
        if (tpl) {
            const dateStr = dateOffset(tpl.dayOffset);
            setFilters(prev => ({ ...prev, dtInicio: dateStr, dtTermino: dateStr, statusAgendamento: [] }));
        } else {
            const fb = FALLBACK_PRESETS[newModel];
            if (fb) {
                const dateStr = dateOffset(fb.dayOffset);
                setFilters(prev => ({ ...prev, dtInicio: dateStr, dtTermino: dateStr, statusAgendamento: [] }));
            }
        }
        setMessages([]);
        setRawAgendamentos([]);
    }, [messageTemplates]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginLoading(true);
        setLoginError('');
        try {
            const { token } = await login(loginEmail, loginPassword);
            const { user } = await getMe(token);
            const hasDisparosAccess = user.isSuperAdmin ||
                user.appAccess?.some((a: any) => a.application?.name === 'disparos');
            if (!hasDisparosAccess) {
                setLoginError('Seu usuário não tem permissão para acessar o Dental Connect. Solicite ao administrador.');
                return;
            }
            sessionStorage.setItem('auth_token', token);
            setAuthenticated(true);
        } catch (err: any) {
            setLoginError(err.message || 'Erro ao fazer login');
        } finally {
            setLoginLoading(false);
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('auth_token');
        setAuthenticated(false);
        setLoginEmail('');
        setLoginPassword('');
        setLoginError('');
    };

    // Not authenticated — show login form
    if (!authenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50">
                <div className="glass-card p-8 max-w-sm w-full space-y-6">
                    <div className="text-center space-y-2">
                        <DentalConnectIcon className="w-16 h-16 mx-auto drop-shadow-lg" />
                        <h1 className="text-xl font-bold text-foreground">Dental Connect</h1>
                        <p className="text-sm text-muted-foreground">Faça login para continuar</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
                            <input
                                type="email"
                                autoComplete="email"
                                required
                                value={loginEmail}
                                onChange={e => setLoginEmail(e.target.value)}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
                                placeholder="seu@email.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Senha</label>
                            <input
                                type="password"
                                autoComplete="current-password"
                                required
                                value={loginPassword}
                                onChange={e => setLoginPassword(e.target.value)}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
                                placeholder="••••••••"
                            />
                        </div>

                        {loginError && (
                            <div className="flex items-start gap-2 text-red-500 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                <WifiOff className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                <span>{loginError}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loginLoading}
                            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-primary to-emerald-600 text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
                        >
                            <Lock className="w-4 h-4" />
                            {loginLoading ? 'Entrando...' : 'Entrar'}
                        </button>
                    </form>
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
                        <DentalConnectIcon className="w-9 h-9 drop-shadow" />
                        <div>
                            <h1 className="text-lg font-bold text-foreground leading-tight">Dental Connect</h1>
                            <p className="text-xs text-muted-foreground">Comunicação inteligente com pacientes</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Tab navigation */}
                        <div className="flex items-center bg-muted/60 rounded-lg p-1 gap-1">
                            <button
                                onClick={() => setActiveTab('manual')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'manual' ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                <Send className="w-3.5 h-3.5" />
                                Manual
                            </button>
                            <button
                                onClick={() => setActiveTab('agendados')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'agendados' ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                <Clock className="w-3.5 h-3.5" />
                                Agendados
                            </button>
                            <button
                                onClick={() => setActiveTab('relatorios')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'relatorios' ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                <BarChart3 className="w-3.5 h-3.5" />
                                Relatórios
                            </button>
                            <button
                                onClick={() => setActiveTab('mensagens')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'mensagens' ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                <Settings2 className="w-3.5 h-3.5" />
                                Mensagens
                            </button>
                        </div>

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
                {/* Agendados Tab */}
                {activeTab === 'agendados' && (
                    <ScheduledDisparos unidadeOptions={unidadeOptions} />
                )}

                {/* Relatórios Tab */}
                {activeTab === 'relatorios' && (
                    <DisparoReports unidadeOptions={unidadeOptions} />
                )}

                {/* Mensagens Tab */}
                {activeTab === 'mensagens' && (
                    <MessageTemplatesTab />
                )}

                {/* Manual Tab */}
                {activeTab === 'manual' && <div className="flex gap-6">
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
                                isUltimaConsulta={isUltimaConsulta}
                            />
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-4">
                        {/* Action bar */}
                        <div className="glass-card px-5 py-4 flex flex-col gap-4 relative z-10">
                            {/* Row 1: Message model selector (top — defines context) */}
                            <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex flex-col gap-0.5">
                                    <label className="text-xs font-medium text-muted-foreground">Mensagem</label>
                                    <select
                                        value={selectedModel}
                                        onChange={(e) => handleModelChange(e.target.value)}
                                        className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground shadow-sm outline-none cursor-pointer hover:border-primary transition-colors h-[38px] font-medium"
                                        disabled={isSending}
                                    >
                                        {messageTemplates.length > 0 ? (
                                            messageTemplates.map(t => (
                                                <option key={t.code} value={t.code}>{t.name}</option>
                                            ))
                                        ) : (
                                            Object.entries(FALLBACK_PRESETS).map(([id, p]) => (
                                                <option key={id} value={id}>{p.name}</option>
                                            ))
                                        )}
                                    </select>
                                </div>
                                {currentPreset && (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-lg text-xs text-primary font-medium mt-4">
                                        <Search className="w-3.5 h-3.5 opacity-70" />
                                        Padrão: {currentPreset.hint}
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-border pt-4 flex flex-col gap-3">
                                {/* Row 2: Date range + units + search */}
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
                                        <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 shadow-sm cursor-pointer hover:bg-muted/50 transition-colors h-[38px]">
                                            <Building2 className="w-4 h-4 text-secondary" />
                                            <span className="text-sm font-medium">
                                                {filters.unidades.length === 0
                                                    ? 'Selecionar Unidades'
                                                    : `${filters.unidades.length} unidade(s)`}
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

                                    {/* Última Consulta Checkboxes */}
                                    <div className="flex items-center gap-3 bg-background border border-border rounded-lg px-3 py-2 shadow-sm h-[38px] select-none">
                                        <label className="flex items-center gap-1.5 text-sm font-semibold text-foreground/80 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="filter-checkbox"
                                                checked={isUltimaConsulta}
                                                onChange={e => {
                                                    setIsUltimaConsulta(e.target.checked);
                                                    setMessages([]);
                                                    setRawAgendamentos([]);
                                                }}
                                            />
                                            <span>Última consulta</span>
                                        </label>

                                        {isUltimaConsulta && (
                                            <>
                                                <div className="w-px h-4 bg-border" />
                                                <label className="flex items-center gap-1.5 text-sm font-semibold text-foreground/80 cursor-pointer animate-fade-in">
                                                    <input
                                                        type="checkbox"
                                                        className="filter-checkbox"
                                                        checked={onlyWithoutScheduled}
                                                        onChange={e => setOnlyWithoutScheduled(e.target.checked)}
                                                    />
                                                    <span>Somente sem consulta agendada</span>
                                                </label>
                                            </>
                                        )}
                                    </div>

                                    <button
                                        onClick={handleSearch}
                                        disabled={loading}
                                        className="px-5 py-2 rounded-lg bg-gradient-to-r from-secondary to-blue-500 text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg shadow-secondary/20 disabled:opacity-50 h-[38px]"
                                    >
                                        {loading ? <Search className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                        Pesquisar
                                    </button>

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
                        </div>

                        {/* Table */}
                        <MessageTable
                            messages={filteredMessages}
                            selectedIds={selectedIds}
                            onToggleSelect={toggleSelect}
                            onSelectAll={selectAll}
                            isSending={isSending}
                            isUltimaConsulta={isUltimaConsulta}
                            loading={loading}
                        />
                    </div>
                </div>}
            </main>

            {/* Send Modal */}
            <SendProgressModal
                open={showSendModal}
                onClose={() => { setShowSendModal(false); setIsSending(false); }}
                onConfirm={handleSend}
                config={sendConfig}
                onConfigChange={setSendConfig}
                totalMessages={isSending ? totalToProcess : selectedCount}
                sentCount={sentCount}
                errorCount={errorCount}
                isSending={isSending}
                currentName={currentSendName}
            />

            <Toaster position="top-right" richColors />
        </div>
    );
}
