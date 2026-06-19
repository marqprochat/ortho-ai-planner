import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import {
    BarChart3, Send, XCircle, RefreshCw, CheckCircle2, AlertCircle,
    Clock, Building2, Calendar, TrendingUp, Filter, ChevronDown,
    ChevronUp, MessageSquare, Loader2, AlertTriangle, X
} from 'lucide-react';
import { api } from '../services/api';

const MODEL_NAMES: Record<string, string> = {
    '22180': 'Confirmação de Consulta',
    '19872': 'Avaliação',
};

interface ReportLog {
    id: string;
    scheduleId: string;
    executedAt: string;
    status: 'completed' | 'failed';
    totalFetched: number;
    totalSent: number;
    totalErrors: number;
    totalProcessed: number;
    errorMessage?: string;
    dtInicio: string;
    dtTermino: string;
    schedule: {
        id: string;
        name: string;
        modelo: string;
        unidades: string[];
    };
}

function todayStr() {
    return new Date().toISOString().split('T')[0];
}

function monthStartStr() {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
}

function formatDateTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR');
}

function successRate(sent: number, errors: number) {
    const total = sent + errors;
    if (total === 0) return null;
    return Math.round((sent / total) * 100);
}

interface UnitCardProps {
    unidade: string;
    totalSent: number;
    totalErrors: number;
    totalProcessed: number;
    executions: number;
    isSelected: boolean;
    onClick: () => void;
}

function UnitCard({ unidade, totalSent, totalErrors, totalProcessed, executions, isSelected, onClick }: UnitCardProps) {
    const rate = successRate(totalSent, totalErrors);
    return (
        <button
            onClick={onClick}
            className={`glass-card p-4 text-left transition-all hover:shadow-md cursor-pointer border-2 ${isSelected ? 'border-primary shadow-md shadow-primary/10' : 'border-transparent'}`}
        >
            <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                    <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-primary/10' : 'bg-muted'}`}>
                        <Building2 className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <span className="text-sm font-semibold text-foreground truncate">{unidade || 'Todas as Unidades'}</span>
                </div>
                {isSelected && <X className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                    <p className="text-lg font-bold text-emerald-600">{totalSent.toLocaleString('pt-BR')}</p>
                    <p className="text-[10px] text-muted-foreground">Enviados</p>
                </div>
                <div>
                    <p className="text-lg font-bold text-red-500">{totalErrors.toLocaleString('pt-BR')}</p>
                    <p className="text-[10px] text-muted-foreground">Erros</p>
                </div>
                <div>
                    <p className="text-lg font-bold text-blue-500">{totalProcessed.toLocaleString('pt-BR')}</p>
                    <p className="text-[10px] text-muted-foreground">Filtrados</p>
                </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
                <span className="text-[10px] text-muted-foreground">{executions} execução(ões)</span>
                {rate !== null && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${rate >= 80 ? 'bg-emerald-100 text-emerald-700' : rate >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>
                        {rate}% sucesso
                    </span>
                )}
            </div>
        </button>
    );
}

interface SummaryCardProps {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    sub?: string;
    color: string;
    bgColor: string;
}

function SummaryCard({ icon, label, value, sub, color, bgColor }: SummaryCardProps) {
    return (
        <div className="glass-card p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${bgColor}`}>
                <div className={color}>{icon}</div>
            </div>
            <div>
                <p className="text-xs text-muted-foreground font-medium">{label}</p>
                <p className="text-2xl font-bold text-foreground">{value}</p>
                {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

interface Props {
    unidadeOptions: string[];
}

export default function DisparoReports({ unidadeOptions }: Props) {
    const [logs, setLogs] = useState<ReportLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [dtInicio, setDtInicio] = useState(monthStartStr());
    const [dtTermino, setDtTermino] = useState(todayStr());
    const [selectedUnidades, setSelectedUnidades] = useState<string[]>([]);
    const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
    const [selectedUnitCard, setSelectedUnitCard] = useState<string | null>(null);
    const [showUnidadesDropdown, setShowUnidadesDropdown] = useState(false);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    const fetchReports = async () => {
        setLoading(true);
        try {
            const data = await api.getDisparoReports(dtInicio, dtTermino);
            setLogs(data);
        } catch (err: any) {
            toast.error('Erro ao carregar relatórios: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    // Filtered logs based on unit and schedule filters
    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            if (selectedUnidades.length > 0) {
                const scheduleUnidades = log.schedule.unidades;
                // If schedule applies to all units (empty array), show it; otherwise check overlap
                const matches = scheduleUnidades.length === 0 ||
                    scheduleUnidades.some(u => selectedUnidades.includes(u));
                if (!matches) return false;
            }
            if (selectedScheduleId && log.scheduleId !== selectedScheduleId) return false;
            return true;
        });
    }, [logs, selectedUnidades, selectedScheduleId]);

    // Build unit cards data
    const unitStats = useMemo(() => {
        const map = new Map<string, { totalSent: number; totalErrors: number; totalProcessed: number; executions: number }>();

        filteredLogs.forEach(log => {
            const units = log.schedule.unidades.length > 0 ? log.schedule.unidades : ['Todas'];
            units.forEach(u => {
                const existing = map.get(u) || { totalSent: 0, totalErrors: 0, totalProcessed: 0, executions: 0 };
                map.set(u, {
                    totalSent: existing.totalSent + log.totalSent,
                    totalErrors: existing.totalErrors + log.totalErrors,
                    totalProcessed: existing.totalProcessed + log.totalProcessed,
                    executions: existing.executions + 1,
                });
            });
        });

        return Array.from(map.entries())
            .map(([unidade, stats]) => ({ unidade, ...stats }))
            .sort((a, b) => b.totalSent - a.totalSent);
    }, [filteredLogs]);

    // Summary totals
    const totals = useMemo(() => {
        const unitFilteredLogs = selectedUnitCard
            ? filteredLogs.filter(log => {
                const units = log.schedule.unidades.length > 0 ? log.schedule.unidades : ['Todas'];
                return units.includes(selectedUnitCard);
            })
            : filteredLogs;

        return {
            executions: unitFilteredLogs.length,
            sent: unitFilteredLogs.reduce((s, l) => s + l.totalSent, 0),
            errors: unitFilteredLogs.reduce((s, l) => s + l.totalErrors, 0),
            processed: unitFilteredLogs.reduce((s, l) => s + l.totalProcessed, 0),
            fetched: unitFilteredLogs.reduce((s, l) => s + l.totalFetched, 0),
        };
    }, [filteredLogs, selectedUnitCard]);

    const displayLogs = useMemo(() => {
        if (!selectedUnitCard) return filteredLogs;
        return filteredLogs.filter(log => {
            const units = log.schedule.unidades.length > 0 ? log.schedule.unidades : ['Todas'];
            return units.includes(selectedUnitCard);
        });
    }, [filteredLogs, selectedUnitCard]);

    const rate = successRate(totals.sent, totals.errors);

    const scheduleOptions = useMemo(() => {
        const map = new Map<string, string>();
        logs.forEach(l => map.set(l.schedule.id, l.schedule.name));
        return Array.from(map.entries());
    }, [logs]);

    const toggleRow = (id: string) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleUnidade = (u: string) => {
        setSelectedUnidades(prev =>
            prev.includes(u) ? prev.filter(x => x !== u) : [...prev, u]
        );
    };

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="glass-card px-5 py-4 flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">Período</label>
                    <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 shadow-sm h-[38px]">
                        <Calendar className="w-4 h-4 text-primary" />
                        <input
                            type="date"
                            className="bg-transparent text-sm outline-none text-foreground"
                            value={dtInicio}
                            onChange={e => setDtInicio(e.target.value)}
                        />
                        <span className="text-muted-foreground text-xs font-medium">até</span>
                        <input
                            type="date"
                            className="bg-transparent text-sm outline-none text-foreground"
                            value={dtTermino}
                            onChange={e => setDtTermino(e.target.value)}
                        />
                    </div>
                </div>

                {/* Unidades dropdown */}
                <div className="flex flex-col gap-1 relative">
                    <label className="text-xs font-medium text-muted-foreground">Unidade</label>
                    <div className="relative">
                        <button
                            onClick={() => setShowUnidadesDropdown(v => !v)}
                            className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 shadow-sm h-[38px] text-sm hover:border-primary transition-colors min-w-[180px]"
                        >
                            <Building2 className="w-4 h-4 text-secondary shrink-0" />
                            <span className="flex-1 text-left truncate">
                                {selectedUnidades.length === 0 ? 'Todas as unidades' : `${selectedUnidades.length} selecionada(s)`}
                            </span>
                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        </button>
                        {showUnidadesDropdown && (
                            <div className="absolute top-full left-0 mt-1 w-72 bg-card border border-border rounded-lg shadow-xl z-20 p-2 max-h-64 overflow-y-auto">
                                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground pb-2 border-b border-border mb-2 px-1">
                                    <input
                                        type="checkbox"
                                        className="filter-checkbox"
                                        checked={selectedUnidades.length === 0}
                                        onChange={() => setSelectedUnidades([])}
                                    />
                                    Todas as unidades
                                </label>
                                {unidadeOptions.map(opt => (
                                    <label key={opt} className="flex items-center gap-2 text-sm p-1.5 hover:bg-muted rounded cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="filter-checkbox"
                                            checked={selectedUnidades.includes(opt)}
                                            onChange={() => toggleUnidade(opt)}
                                        />
                                        <span className="truncate">{opt}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Schedule filter */}
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">Disparo</label>
                    <select
                        value={selectedScheduleId || ''}
                        onChange={e => setSelectedScheduleId(e.target.value || null)}
                        className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground shadow-sm outline-none cursor-pointer hover:border-primary transition-colors h-[38px] min-w-[180px]"
                    >
                        <option value="">Todos os disparos</option>
                        {scheduleOptions.map(([id, name]) => (
                            <option key={id} value={id}>{name}</option>
                        ))}
                    </select>
                </div>

                <button
                    onClick={fetchReports}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-emerald-600 text-white text-sm font-medium hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 disabled:opacity-50 h-[38px] mt-auto"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Atualizar
                </button>

                {(selectedUnidades.length > 0 || selectedScheduleId || selectedUnitCard) && (
                    <button
                        onClick={() => { setSelectedUnidades([]); setSelectedScheduleId(null); setSelectedUnitCard(null); }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors h-[38px] mt-auto"
                    >
                        <X className="w-3.5 h-3.5" />
                        Limpar filtros
                    </button>
                )}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <SummaryCard
                    icon={<BarChart3 className="w-5 h-5" />}
                    label="Execuções"
                    value={totals.executions}
                    sub={`no período`}
                    color="text-purple-600"
                    bgColor="bg-purple-100"
                />
                <SummaryCard
                    icon={<Send className="w-5 h-5" />}
                    label="Enviados"
                    value={totals.sent.toLocaleString('pt-BR')}
                    sub="mensagens entregues"
                    color="text-emerald-600"
                    bgColor="bg-emerald-100"
                />
                <SummaryCard
                    icon={<XCircle className="w-5 h-5" />}
                    label="Erros"
                    value={totals.errors.toLocaleString('pt-BR')}
                    sub="falhas de envio"
                    color="text-red-500"
                    bgColor="bg-red-100"
                />
                <SummaryCard
                    icon={<Filter className="w-5 h-5" />}
                    label="Filtrados"
                    value={totals.processed.toLocaleString('pt-BR')}
                    sub="passaram pelos filtros"
                    color="text-blue-600"
                    bgColor="bg-blue-100"
                />
                <SummaryCard
                    icon={<TrendingUp className="w-5 h-5" />}
                    label="Taxa de Sucesso"
                    value={rate !== null ? `${rate}%` : '—'}
                    sub={rate !== null ? (rate >= 80 ? 'Excelente' : rate >= 50 ? 'Regular' : 'Crítico') : 'sem dados'}
                    color={rate === null ? 'text-muted-foreground' : rate >= 80 ? 'text-emerald-600' : rate >= 50 ? 'text-yellow-600' : 'text-red-500'}
                    bgColor={rate === null ? 'bg-muted' : rate >= 80 ? 'bg-emerald-100' : rate >= 50 ? 'bg-yellow-100' : 'bg-red-100'}
                />
            </div>

            {/* Unit Cards */}
            {unitStats.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <h2 className="text-sm font-semibold text-foreground">Por Unidade</h2>
                        <span className="text-xs text-muted-foreground">(clique para filtrar a tabela)</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {unitStats.map(({ unidade, totalSent, totalErrors, totalProcessed, executions }) => (
                            <UnitCard
                                key={unidade}
                                unidade={unidade}
                                totalSent={totalSent}
                                totalErrors={totalErrors}
                                totalProcessed={totalProcessed}
                                executions={executions}
                                isSelected={selectedUnitCard === unidade}
                                onClick={() => setSelectedUnitCard(prev => prev === unidade ? null : unidade)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Logs Table */}
            <div className="glass-card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-muted-foreground" />
                        <h2 className="text-sm font-semibold text-foreground">Histórico de Execuções</h2>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{displayLogs.length}</span>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm">Carregando relatório...</span>
                    </div>
                ) : displayLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                        <BarChart3 className="w-10 h-10 opacity-30" />
                        <p className="text-sm">Nenhum disparo encontrado no período</p>
                        <p className="text-xs opacity-70">Ajuste os filtros ou o intervalo de datas</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {/* Header */}
                        <div className="grid grid-cols-[1.5fr_1.2fr_1fr_0.8fr_80px_80px_80px_80px_32px] gap-2 px-5 py-2.5 text-xs font-semibold text-muted-foreground bg-muted/30">
                            <span>Data do Disparo</span>
                            <span>Agendamento</span>
                            <span>Unidades</span>
                            <span>Mensagem</span>
                            <span className="text-center">Enviados</span>
                            <span className="text-center">Erros</span>
                            <span className="text-center">Filtrados</span>
                            <span className="text-center">Status</span>
                            <span />
                        </div>

                        {displayLogs.map(log => {
                            const isExpanded = expandedRows.has(log.id);
                            const msgName = MODEL_NAMES[log.schedule.modelo] || `Modelo ${log.schedule.modelo}`;
                            const units = log.schedule.unidades.length > 0 ? log.schedule.unidades : ['Todas'];

                            return (
                                <div key={log.id} className="hover:bg-muted/20 transition-colors">
                                    <button
                                        className="grid grid-cols-[1.5fr_1.2fr_1fr_0.8fr_80px_80px_80px_80px_32px] gap-2 px-5 py-3 w-full text-left items-center"
                                        onClick={() => toggleRow(log.id)}
                                    >
                                        <span className="text-sm text-foreground font-medium">{formatDateTime(log.executedAt)}</span>
                                        <span className="text-sm text-foreground truncate">{log.schedule.name}</span>
                                        <div className="flex flex-wrap gap-1">
                                            {units.slice(0, 2).map(u => (
                                                <span key={u} className="text-[10px] bg-secondary/10 text-secondary px-1.5 py-0.5 rounded-full truncate max-w-[100px]">{u}</span>
                                            ))}
                                            {units.length > 2 && (
                                                <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">+{units.length - 2}</span>
                                            )}
                                        </div>
                                        <span className="text-xs text-muted-foreground truncate">{msgName}</span>
                                        <span className="text-sm font-semibold text-emerald-600 text-center">{log.totalSent}</span>
                                        <span className="text-sm font-semibold text-red-500 text-center">{log.totalErrors}</span>
                                        <span className="text-sm font-semibold text-blue-600 text-center">{log.totalProcessed}</span>
                                        <div className="flex justify-center">
                                            {log.status === 'completed' ? (
                                                <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                                    <CheckCircle2 className="w-3 h-3" /> OK
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-[10px] font-medium text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                                                    <AlertCircle className="w-3 h-3" /> Falhou
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex justify-center">
                                            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                                        </div>
                                    </button>

                                    {/* Expanded detail */}
                                    {isExpanded && (
                                        <div className="px-5 pb-4 bg-muted/20 border-t border-border">
                                            <div className="flex flex-wrap gap-6 pt-3">
                                                <div>
                                                    <p className="text-xs text-muted-foreground mb-0.5">Intervalo de Datas Usado</p>
                                                    <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                                        <Calendar className="w-3.5 h-3.5 text-primary" />
                                                        {formatDate(log.dtInicio)} → {formatDate(log.dtTermino)}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground mb-0.5">Total Buscados (API)</p>
                                                    <p className="text-sm font-medium text-foreground">{log.totalFetched} agendamentos</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground mb-0.5">Filtrados (prontos p/ envio)</p>
                                                    <p className="text-sm font-medium text-foreground">{log.totalProcessed} pacientes</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground mb-0.5">Mensagem</p>
                                                    <p className="text-sm font-medium text-foreground">{msgName}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground mb-0.5">Unidades Configuradas</p>
                                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                                        {units.map(u => (
                                                            <span key={u} className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full">{u}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                                {log.errorMessage && (
                                                    <div className="w-full">
                                                        <p className="text-xs text-muted-foreground mb-0.5">Mensagem de Erro</p>
                                                        <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                                            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                                            <span>{log.errorMessage}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
