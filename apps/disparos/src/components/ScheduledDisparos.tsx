import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
    Plus, Pencil, Trash2, Play, Clock, ChevronDown, ChevronUp,
    CheckCircle, XCircle, Loader2, Calendar, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { api } from '../services/api';
import type { ScheduledDisparo, ScheduledDisparoLog, ScheduledDisparoFormData } from '../types';
import CronBuilder, { cronToHuman } from './CronBuilder';


const MODELO_OPTIONS = [
    { value: '22180', label: 'Confirmação de Consulta' },
    { value: '19872', label: 'Avaliação' },
];

const STATUS_OPTIONS = [
    { code: 'AEX', label: 'Agendado externo',                   color: '#F59E0B' },
    { code: 'AGD', label: 'Agendado',                           color: '#FDE68A' },
    { code: 'AGP', label: 'Aguardando confirmação profissional', color: '#06B6D4' },
    { code: 'AGU', label: 'Aguardando confirmação paciente',     color: '#67E8F9' },
    { code: 'ATE', label: 'Atendido',                           color: '#9CA3AF' },
    { code: 'CON', label: 'Confirmado',                         color: '#16A34A' },
    { code: 'DCA', label: 'Desmarcado pelo Paciente',           color: '#F97316' },
    { code: 'DPP', label: 'Desmarcado pelo Dentista',           color: '#C4B5FD' },
    { code: 'FAL', label: 'Faltou',                             color: '#EF4444' },
    { code: 'MDA', label: 'Mudar horario (desmarcar)',          color: '#1D4ED8' },
    { code: 'NAT', label: 'Não atendido',                       color: '#7C2D12' },
    { code: 'PRE', label: 'Pré Agendado',                       color: '#D1D5DB' },
    { code: 'RCP', label: 'Recepção',                           color: '#EC4899' },
];

const DEFAULT_FORM: ScheduledDisparoFormData = {
    name: '',
    description: '',
    cronExpression: '0 8 * * *',
    isActive: true,
    unidades: [],
    agendas: [],
    statusAgendamento: [],
    periodos: [],
    motivo: '',
    dtInicioOffset: 1,
    dtTerminoOffset: 1,
    modelo: '22180',
    delayMs: 1000,
    concurrentLimit: 5,
};

function StatusBadge({ status }: { status: string }) {
    if (status === 'completed') return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
            <CheckCircle className="w-3 h-3" /> Concluído
        </span>
    );
    if (status === 'failed') return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
            <XCircle className="w-3 h-3" /> Falhou
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
            <Loader2 className="w-3 h-3 animate-spin" /> Executando
        </span>
    );
}

function LogsPanel({ scheduleId }: { scheduleId: string }) {
    const [logs, setLogs] = useState<ScheduledDisparoLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getScheduledDisparoLogs(scheduleId)
            .then(setLogs)
            .catch(() => setLogs([]))
            .finally(() => setLoading(false));
    }, [scheduleId]);

    if (loading) return <div className="py-4 text-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Carregando histórico...</div>;
    if (logs.length === 0) return <div className="py-4 text-center text-sm text-muted-foreground italic">Nenhuma execução ainda</div>;

    return (
        <div className="mt-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Últimas execuções</p>
            <div className="divide-y divide-border">
                {logs.map(log => (
                    <div key={log.id} className="py-2.5 space-y-1">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <StatusBadge status={log.status} />
                                <span className="text-xs text-muted-foreground">
                                    {new Date(log.executedAt).toLocaleString('pt-BR')}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {log.dtInicio} → {log.dtTermino}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                                <span className="text-emerald-600 font-medium">{log.totalSent} enviados</span>
                                {log.totalErrors > 0 && <span className="text-red-500 font-medium">{log.totalErrors} erros</span>}
                                <span className="text-muted-foreground">{log.totalProcessed} filtrados</span>
                                <span className="text-blue-500 font-medium">{log.totalFetched ?? '—'} buscados</span>
                            </div>
                        </div>
                        {log.errorMessage && (
                            <p className="text-xs text-red-500 pl-1 truncate" title={log.errorMessage}>
                                Erro: {log.errorMessage}
                            </p>
                        )}
                        {log.status === 'completed' && log.totalFetched > 0 && log.totalProcessed === 0 && (
                            <p className="text-xs text-amber-600 pl-1">
                                ⚠ {log.totalFetched} registros buscados mas nenhum passou pelos filtros — verifique os filtros de status/agenda/período configurados.
                            </p>
                        )}
                        {log.status === 'completed' && log.totalFetched === 0 && (
                            <p className="text-xs text-muted-foreground pl-1">
                                Nenhum agendamento encontrado para o período {log.dtInicio} → {log.dtTermino}.
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

interface ScheduleFormProps {
    initial: ScheduledDisparoFormData;
    unidadeOptions: string[];
    onSubmit: (data: ScheduledDisparoFormData) => Promise<void>;
    onCancel: () => void;
    loading: boolean;
}

function ScheduleForm({ initial, unidadeOptions, onSubmit, onCancel, loading }: ScheduleFormProps) {
    const [form, setForm] = useState<ScheduledDisparoFormData>(initial);

    const set = (patch: Partial<ScheduledDisparoFormData>) => setForm(prev => ({ ...prev, ...patch }));

    const toggleArray = (field: keyof Pick<ScheduledDisparoFormData, 'unidades' | 'agendas' | 'statusAgendamento' | 'periodos'>, value: string) => {
        const arr = form[field] as string[];
        set({ [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] });
    };

    return (
        <form onSubmit={e => { e.preventDefault(); onSubmit(form); }} className="space-y-5">
            {/* Nome + Descrição */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Nome *</label>
                    <input
                        required
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background outline-none focus:border-primary"
                        value={form.name}
                        onChange={e => set({ name: e.target.value })}
                        placeholder="Ex: Lembrete Diário Manhã"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Descrição</label>
                    <input
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background outline-none focus:border-primary"
                        value={form.description || ''}
                        onChange={e => set({ description: e.target.value })}
                        placeholder="Opcional"
                    />
                </div>
            </div>

            {/* Horário — CronBuilder visual */}
            <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Horário de execução *</label>
                <CronBuilder
                    value={form.cronExpression}
                    onChange={cron => set({ cronExpression: cron })}
                />
            </div>

            {/* Offset de datas */}
            <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Período de consultas (relativo a hoje)</label>
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">De</span>
                        <input
                            type="number" min={-30} max={30}
                            className="w-20 px-3 py-2 text-sm border border-border rounded-lg bg-background outline-none focus:border-primary text-center"
                            value={form.dtInicioOffset}
                            onChange={e => set({ dtInicioOffset: parseInt(e.target.value) || 0 })}
                        />
                        <span className="text-xs text-muted-foreground">
                            {form.dtInicioOffset < 0
                                ? `dia(s) atrás`
                                : form.dtInicioOffset === 0
                                    ? 'hoje'
                                    : 'dia(s) à frente'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">até</span>
                        <input
                            type="number" min={-30} max={30}
                            className="w-20 px-3 py-2 text-sm border border-border rounded-lg bg-background outline-none focus:border-primary text-center"
                            value={form.dtTerminoOffset}
                            onChange={e => set({ dtTerminoOffset: parseInt(e.target.value) || 0 })}
                        />
                        <span className="text-xs text-muted-foreground">
                            {form.dtTerminoOffset < 0
                                ? `dia(s) atrás`
                                : form.dtTerminoOffset === 0
                                    ? 'hoje'
                                    : 'dia(s) à frente'}
                        </span>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground">
                    Negativo = dias passados. Ex: <strong>-1 até -1</strong> = ontem · <strong>1 até 1</strong> = amanhã · <strong>-1 até 1</strong> = ontem, hoje e amanhã.
                </p>
            </div>

            {/* Unidades */}
            {unidadeOptions.length > 0 && (
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground">Unidades (vazio = todas)</label>
                    <div className="flex flex-wrap gap-2">
                        {unidadeOptions.map(u => (
                            <label key={u} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border cursor-pointer transition-colors ${form.unidades.includes(u)
                                ? 'border-primary bg-primary/10 text-primary font-semibold'
                                : 'border-border bg-background text-muted-foreground hover:border-primary/50'}`}>
                                <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={form.unidades.includes(u)}
                                    onChange={() => toggleArray('unidades', u)}
                                />
                                {u}
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {/* Status de Agendamento */}
            <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">
                    Status de agendamento{' '}
                    <span className="font-normal text-muted-foreground">(vazio = todos)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map(s => {
                        const selected = form.statusAgendamento.includes(s.code);
                        return (
                            <label
                                key={s.code}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border cursor-pointer transition-colors ${selected
                                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                                    : 'border-border bg-background text-muted-foreground hover:border-primary/50'}`}
                            >
                                <input type="checkbox" className="sr-only" checked={selected} onChange={() => toggleArray('statusAgendamento', s.code)} />
                                <span
                                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: s.color, border: s.color === '#D1D5DB' ? '1px solid #9CA3AF' : undefined }}
                                />
                                <span className="font-mono font-bold">{s.code}</span>
                                <span className="hidden sm:inline">— {s.label}</span>
                            </label>
                        );
                    })}
                </div>
            </div>

            {/* Período */}
            <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Período (vazio = ambos)</label>
                <div className="flex gap-2">
                    {['Manhã', 'Tarde'].map(p => (
                        <label key={p} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border cursor-pointer transition-colors ${form.periodos.includes(p)
                            ? 'border-primary bg-primary/10 text-primary font-semibold'
                            : 'border-border bg-background text-muted-foreground hover:border-primary/50'}`}>
                            <input type="checkbox" className="sr-only" checked={form.periodos.includes(p)} onChange={() => toggleArray('periodos', p)} />
                            {p}
                        </label>
                    ))}
                </div>
            </div>

            {/* Motivo */}
            <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Filtro de motivo (contém)</label>
                <input
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background outline-none focus:border-primary"
                    value={form.motivo}
                    onChange={e => set({ motivo: e.target.value })}
                    placeholder="Ex: Ortodontia (vazio = todos)"
                />
            </div>

            {/* Template */}
            <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Template de mensagem</label>
                <select
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background outline-none focus:border-primary"
                    value={form.modelo}
                    onChange={e => set({ modelo: e.target.value })}
                >
                    {MODELO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            </div>

            {/* Rate limiting */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Delay entre lotes (ms)</label>
                    <input
                        type="number" min={500} max={30000} step={500}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background outline-none focus:border-primary"
                        value={form.delayMs}
                        onChange={e => set({ delayMs: parseInt(e.target.value) || 1000 })}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Mensagens simultâneas</label>
                    <input
                        type="number" min={1} max={10}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background outline-none focus:border-primary"
                        value={form.concurrentLimit}
                        onChange={e => set({ concurrentLimit: parseInt(e.target.value) || 5 })}
                    />
                </div>
            </div>

            {/* Ativo */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? 'bg-primary' : 'bg-muted'}`}
                    onClick={() => set({ isActive: !form.isActive })}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </div>
                <span className="text-sm font-medium text-foreground">{form.isActive ? 'Ativo' : 'Inativo'}</span>
            </label>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
                <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Cancelar
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 rounded-lg bg-gradient-to-r from-primary to-emerald-600 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Salvar Agendamento
                </button>
            </div>
        </form>
    );
}

interface ScheduleCardProps {
    schedule: ScheduledDisparo;
    onEdit: (s: ScheduledDisparo) => void;
    onDelete: (id: string) => void;
    onTrigger: (id: string) => void;
    onToggle: (s: ScheduledDisparo) => void;
}

function ScheduleCard({ schedule, onEdit, onDelete, onTrigger, onToggle }: ScheduleCardProps) {
    const [showLogs, setShowLogs] = useState(false);
    const lastLog = schedule.logs?.[0];

    function fmtOffset(n: number) {
        if (n === 0) return 'hoje';
        return n > 0 ? `+${n}d` : `${n}d`;
    }
    const offsetLabel = schedule.dtInicioOffset === schedule.dtTerminoOffset
        ? fmtOffset(schedule.dtInicioOffset)
        : `${fmtOffset(schedule.dtInicioOffset)} a ${fmtOffset(schedule.dtTerminoOffset)}`;

    const modeloLabel = MODELO_OPTIONS.find(o => o.value === schedule.modelo)?.label || schedule.modelo;

    return (
        <div className={`glass-card p-5 transition-all ${!schedule.isActive ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground text-base">{schedule.name}</h3>
                        {schedule.isActive
                            ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Ativo</span>
                            : <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Inativo</span>}
                        {lastLog && <StatusBadge status={lastLog.status} />}
                    </div>
                    {schedule.description && (
                        <p className="text-sm text-muted-foreground mt-0.5">{schedule.description}</p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span className="font-medium text-foreground">{cronToHuman(schedule.cronExpression)}</span>
                            <code className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{schedule.cronExpression}</code>
                        </span>
                        <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {offsetLabel}
                        </span>
                        <span>{modeloLabel}</span>
                        {schedule.unidades.length > 0 && (
                            <span>{schedule.unidades.length} unidade(s)</span>
                        )}
                        {schedule.statusAgendamento.length > 0 && (
                            <span className="flex items-center gap-1">
                                {schedule.statusAgendamento.map(code => {
                                    const opt = STATUS_OPTIONS.find(s => s.code === code);
                                    return (
                                        <span key={code} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono font-bold" title={opt?.label}>
                                            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: opt?.color ?? '#9CA3AF' }} />
                                            {code}
                                        </span>
                                    );
                                })}
                            </span>
                        )}
                        {schedule.periodos.length > 0 && (
                            <span>{schedule.periodos.join(', ')}</span>
                        )}
                        {schedule.motivo && <span>Motivo: "{schedule.motivo}"</span>}
                    </div>

                    {lastLog && (
                        <div className="mt-2 text-xs text-muted-foreground">
                            Última execução: {new Date(lastLog.executedAt).toLocaleString('pt-BR')}
                            {' — '}
                            <span className="text-blue-500">{lastLog.totalFetched ?? '—'} buscados</span>
                            {' · '}
                            <span className="text-muted-foreground">{lastLog.totalProcessed} filtrados</span>
                            {' · '}
                            <span className="text-emerald-600">{lastLog.totalSent} enviados</span>
                            {lastLog.totalErrors > 0 && <span className="text-red-500 ml-1">· {lastLog.totalErrors} erros</span>}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                    <button
                        onClick={() => onToggle(schedule)}
                        className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title={schedule.isActive ? 'Desativar' : 'Ativar'}
                    >
                        {schedule.isActive ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button
                        onClick={() => onTrigger(schedule.id)}
                        className="p-2 rounded-lg hover:bg-emerald-50 transition-colors text-muted-foreground hover:text-emerald-600"
                        title="Executar agora"
                    >
                        <Play className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onEdit(schedule)}
                        className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title="Editar"
                    >
                        <Pencil className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onDelete(schedule.id)}
                        className="p-2 rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
                        title="Excluir"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setShowLogs(v => !v)}
                        className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title="Histórico"
                    >
                        {showLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {showLogs && <LogsPanel scheduleId={schedule.id} />}
        </div>
    );
}

interface Props {
    unidadeOptions: string[];
}

export default function ScheduledDisparos({ unidadeOptions }: Props) {
    const [schedules, setSchedules] = useState<ScheduledDisparo[]>([]);
    const [loading, setLoading] = useState(true);
    const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
    const [editTarget, setEditTarget] = useState<ScheduledDisparo | null>(null);
    const [saving, setSaving] = useState(false);

    const fetchSchedules = useCallback(async () => {
        try {
            const data = await api.listScheduledDisparos();
            setSchedules(data);
        } catch (err: any) {
            toast.error('Erro ao carregar agendamentos: ' + err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

    const handleCreate = async (data: ScheduledDisparoFormData) => {
        setSaving(true);
        try {
            await api.createScheduledDisparo(data);
            toast.success('Agendamento criado com sucesso!');
            setFormMode(null);
            fetchSchedules();
        } catch (err: any) {
            toast.error('Erro ao criar: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = async (data: ScheduledDisparoFormData) => {
        if (!editTarget) return;
        setSaving(true);
        try {
            await api.updateScheduledDisparo(editTarget.id, data);
            toast.success('Agendamento atualizado!');
            setFormMode(null);
            setEditTarget(null);
            fetchSchedules();
        } catch (err: any) {
            toast.error('Erro ao atualizar: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este agendamento?')) return;
        try {
            await api.deleteScheduledDisparo(id);
            toast.success('Agendamento excluído');
            fetchSchedules();
        } catch (err: any) {
            toast.error('Erro ao excluir: ' + err.message);
        }
    };

    const handleTrigger = async (id: string) => {
        try {
            await api.triggerScheduledDisparo(id);
            toast.success('Disparo iniciado em background! Veja o histórico em instantes.');
        } catch (err: any) {
            toast.error('Erro ao disparar: ' + err.message);
        }
    };

    const handleToggle = async (schedule: ScheduledDisparo) => {
        try {
            await api.updateScheduledDisparo(schedule.id, { isActive: !schedule.isActive });
            toast.success(schedule.isActive ? 'Agendamento desativado' : 'Agendamento ativado');
            fetchSchedules();
        } catch (err: any) {
            toast.error('Erro: ' + err.message);
        }
    };

    const openEdit = (schedule: ScheduledDisparo) => {
        setEditTarget(schedule);
        setFormMode('edit');
    };

    const closeForm = () => { setFormMode(null); setEditTarget(null); };

    const formInitial: ScheduledDisparoFormData = editTarget
        ? {
            name: editTarget.name,
            description: editTarget.description || '',
            cronExpression: editTarget.cronExpression,
            isActive: editTarget.isActive,
            unidades: editTarget.unidades,
            agendas: editTarget.agendas,
            statusAgendamento: editTarget.statusAgendamento,
            periodos: editTarget.periodos,
            motivo: editTarget.motivo,
            dtInicioOffset: editTarget.dtInicioOffset,
            dtTerminoOffset: editTarget.dtTerminoOffset,
            modelo: editTarget.modelo,
            delayMs: editTarget.delayMs,
            concurrentLimit: editTarget.concurrentLimit,
        }
        : DEFAULT_FORM;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-foreground">Envios Automáticos</h2>
                    <p className="text-sm text-muted-foreground">Configure mensagens automáticas recorrentes por horário</p>
                </div>
                {formMode === null && (
                    <button
                        onClick={() => setFormMode('create')}
                        className="px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-emerald-600 text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg shadow-primary/20"
                    >
                        <Plus className="w-4 h-4" />
                        Novo Agendamento
                    </button>
                )}
            </div>

            {/* Form */}
            {formMode && (
                <div className="glass-card p-6">
                    <h3 className="text-base font-semibold text-foreground mb-5">
                        {formMode === 'create' ? 'Novo Agendamento' : `Editar: ${editTarget?.name}`}
                    </h3>
                    <ScheduleForm
                        initial={formInitial}
                        unidadeOptions={unidadeOptions}
                        onSubmit={formMode === 'create' ? handleCreate : handleEdit}
                        onCancel={closeForm}
                        loading={saving}
                    />
                </div>
            )}

            {/* List */}
            {loading ? (
                <div className="glass-card p-10 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin inline mr-2" />
                    Carregando agendamentos...
                </div>
            ) : schedules.length === 0 ? (
                <div className="glass-card p-10 text-center space-y-3">
                    <Clock className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                    <p className="text-muted-foreground font-medium">Nenhum agendamento configurado</p>
                    <p className="text-sm text-muted-foreground">Crie seu primeiro agendamento para automatizar o envio de mensagens</p>
                    <button
                        onClick={() => setFormMode('create')}
                        className="mt-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
                    >
                        Criar agendamento
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {schedules.map(schedule => (
                        <ScheduleCard
                            key={schedule.id}
                            schedule={schedule}
                            onEdit={openEdit}
                            onDelete={handleDelete}
                            onTrigger={handleTrigger}
                            onToggle={handleToggle}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
