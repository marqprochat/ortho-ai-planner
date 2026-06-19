import { useState, useEffect } from 'react';
import { Clock, Calendar, RefreshCw } from 'lucide-react';

type Frequencia = 'todo-dia' | 'dias-uteis' | 'fins-semana' | 'dias-especificos';

interface CronConfig {
    frequencia: Frequencia;
    hora: number;
    minuto: number;
    diasSemana: number[]; // 0=Dom,1=Seg...6=Sáb
}

const DIAS = [
    { idx: 0, short: 'Dom', label: 'Domingo' },
    { idx: 1, short: 'Seg', label: 'Segunda' },
    { idx: 2, short: 'Ter', label: 'Terça' },
    { idx: 3, short: 'Qua', label: 'Quarta' },
    { idx: 4, short: 'Qui', label: 'Quinta' },
    { idx: 5, short: 'Sex', label: 'Sexta' },
    { idx: 6, short: 'Sáb', label: 'Sábado' },
];

const HORAS = Array.from({ length: 24 }, (_, i) => i);
const MINUTOS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function parseCron(cron: string): CronConfig {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) return { frequencia: 'todo-dia', hora: 8, minuto: 0, diasSemana: [] };

    const [min, hour, , , dow] = parts;
    const hora = Math.min(23, Math.max(0, parseInt(hour) || 0));
    const minuto = Math.min(59, Math.max(0, parseInt(min) || 0));

    if (dow === '*') return { frequencia: 'todo-dia', hora, minuto, diasSemana: [] };
    if (dow === '1-5') return { frequencia: 'dias-uteis', hora, minuto, diasSemana: [] };
    if (dow === '0,6' || dow === '6,0') return { frequencia: 'fins-semana', hora, minuto, diasSemana: [0, 6] };

    const days = dow.split(',').map(Number).filter(n => !isNaN(n) && n >= 0 && n <= 6);
    return { frequencia: 'dias-especificos', hora, minuto, diasSemana: days };
}

export function buildCron(config: CronConfig): string {
    const { hora, minuto, frequencia, diasSemana } = config;
    const m = minuto.toString().padStart(2, '0');
    const h = hora.toString();
    switch (frequencia) {
        case 'todo-dia': return `${m} ${h} * * *`;
        case 'dias-uteis': return `${m} ${h} * * 1-5`;
        case 'fins-semana': return `${m} ${h} * * 0,6`;
        case 'dias-especificos':
            if (diasSemana.length === 0) return `${m} ${h} * * *`;
            return `${m} ${h} * * ${[...diasSemana].sort((a, b) => a - b).join(',')}`;
    }
}

export function cronToHuman(cron: string): string {
    if (!cron) return '—';
    const c = parseCron(cron);
    const time = `${c.hora.toString().padStart(2, '0')}:${c.minuto.toString().padStart(2, '0')}`;
    switch (c.frequencia) {
        case 'todo-dia': return `Todo dia às ${time}`;
        case 'dias-uteis': return `Dias úteis (Seg–Sex) às ${time}`;
        case 'fins-semana': return `Finais de semana às ${time}`;
        case 'dias-especificos': {
            if (c.diasSemana.length === 0) return `Sem dias selecionados`;
            const names = [...c.diasSemana].sort((a, b) => a - b).map(d => DIAS[d].short).join(', ');
            return `${names} às ${time}`;
        }
    }
}

interface Props {
    value: string;
    onChange: (cron: string) => void;
}

const FREQ_OPTIONS: { value: Frequencia; label: string; sub: string }[] = [
    { value: 'todo-dia',        label: 'Todo dia',        sub: 'Incluindo finais de semana' },
    { value: 'dias-uteis',      label: 'Dias úteis',      sub: 'Segunda a sexta-feira' },
    { value: 'fins-semana',     label: 'Fins de semana',  sub: 'Sábado e domingo' },
    { value: 'dias-especificos', label: 'Dias específicos', sub: 'Escolha quais dias' },
];

export default function CronBuilder({ value, onChange }: Props) {
    const [config, setConfig] = useState<CronConfig>(() => parseCron(value));

    // Sync outward whenever config changes
    useEffect(() => {
        onChange(buildCron(config));
    }, [config]);

    // Sync inward when value changes externally (reset form)
    useEffect(() => {
        const parsed = parseCron(value);
        setConfig(parsed);
    }, []);

    const patch = (partial: Partial<CronConfig>) =>
        setConfig(prev => ({ ...prev, ...partial }));

    const toggleDia = (idx: number) => {
        const next = config.diasSemana.includes(idx)
            ? config.diasSemana.filter(d => d !== idx)
            : [...config.diasSemana, idx];
        patch({ diasSemana: next });
    };

    const human = cronToHuman(buildCron(config));
    const cronExpr = buildCron(config);

    return (
        <div className="space-y-4">
            {/* Frequência */}
            <div>
                <label className="text-xs font-semibold text-foreground mb-2 block">Frequência</label>
                <div className="grid grid-cols-2 gap-2">
                    {FREQ_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => patch({ frequencia: opt.value, diasSemana: opt.value === 'fins-semana' ? [0, 6] : opt.value === 'dias-uteis' ? [] : config.diasSemana })}
                            className={`flex flex-col items-start px-4 py-3 rounded-xl border-2 text-left transition-all ${config.frequencia === opt.value
                                ? 'border-primary bg-primary/5 shadow-sm'
                                : 'border-border bg-background hover:border-primary/40 hover:bg-muted/50'}`}
                        >
                            <span className={`text-sm font-semibold ${config.frequencia === opt.value ? 'text-primary' : 'text-foreground'}`}>{opt.label}</span>
                            <span className="text-[11px] text-muted-foreground mt-0.5">{opt.sub}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Dias específicos */}
            {config.frequencia === 'dias-especificos' && (
                <div>
                    <label className="text-xs font-semibold text-foreground mb-2 block">Dias da semana</label>
                    <div className="flex gap-1.5 flex-wrap">
                        {DIAS.map(dia => {
                            const selected = config.diasSemana.includes(dia.idx);
                            const isWeekend = dia.idx === 0 || dia.idx === 6;
                            return (
                                <button
                                    key={dia.idx}
                                    type="button"
                                    onClick={() => toggleDia(dia.idx)}
                                    className={`w-11 h-11 rounded-xl text-xs font-bold transition-all border-2 ${selected
                                        ? 'bg-primary text-white border-primary shadow-sm shadow-primary/30'
                                        : isWeekend
                                            ? 'border-border bg-muted/60 text-muted-foreground hover:border-primary/40'
                                            : 'border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted/50'}`}
                                    title={dia.label}
                                >
                                    {dia.short}
                                </button>
                            );
                        })}
                    </div>
                    {config.diasSemana.length === 0 && (
                        <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                            <span>⚠</span> Selecione pelo menos um dia
                        </p>
                    )}
                </div>
            )}

            {/* Horário */}
            <div>
                <label className="text-xs font-semibold text-foreground mb-2 block">Horário</label>
                <div className="flex items-center gap-3">
                    {/* Hora */}
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Hora</span>
                        <div className="flex items-center gap-1.5 bg-background border-2 border-border rounded-xl px-3 py-2 focus-within:border-primary transition-colors">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                            <select
                                value={config.hora}
                                onChange={e => patch({ hora: parseInt(e.target.value) })}
                                className="bg-transparent text-sm font-semibold text-foreground outline-none cursor-pointer"
                            >
                                {HORAS.map(h => (
                                    <option key={h} value={h}>{h.toString().padStart(2, '0')}h</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <span className="text-2xl font-bold text-muted-foreground mt-4">:</span>

                    {/* Minuto */}
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Minuto</span>
                        <div className="flex items-center gap-1.5 bg-background border-2 border-border rounded-xl px-3 py-2 focus-within:border-primary transition-colors">
                            <select
                                value={config.minuto}
                                onChange={e => patch({ minuto: parseInt(e.target.value) })}
                                className="bg-transparent text-sm font-semibold text-foreground outline-none cursor-pointer"
                            >
                                {MINUTOS.map(m => (
                                    <option key={m} value={m}>{m.toString().padStart(2, '0')}min</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Quick time buttons */}
                    <div className="flex flex-col gap-1 ml-2">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Atalhos</span>
                        <div className="flex gap-1.5">
                            {[
                                { h: 7, m: 0, label: '07h' },
                                { h: 8, m: 0, label: '08h' },
                                { h: 9, m: 0, label: '09h' },
                                { h: 12, m: 0, label: '12h' },
                                { h: 17, m: 0, label: '17h' },
                                { h: 18, m: 0, label: '18h' },
                            ].map(t => (
                                <button
                                    key={t.h}
                                    type="button"
                                    onClick={() => patch({ hora: t.h, minuto: t.m })}
                                    className={`px-2 py-1.5 text-xs rounded-lg border transition-all ${config.hora === t.h && config.minuto === t.m
                                        ? 'border-primary bg-primary/10 text-primary font-semibold'
                                        : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'}`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Preview */}
            <div className="flex items-center gap-3 bg-gradient-to-r from-primary/5 to-emerald-50 border border-primary/20 rounded-xl px-4 py-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                    <Calendar className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{human}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Fuso horário: America/Sao_Paulo</p>
                </div>
                <div className="flex items-center gap-1.5 bg-muted border border-border rounded-lg px-2.5 py-1.5">
                    <RefreshCw className="w-3 h-3 text-muted-foreground" />
                    <code className="text-xs font-mono text-muted-foreground">{cronExpr}</code>
                </div>
            </div>
        </div>
    );
}
