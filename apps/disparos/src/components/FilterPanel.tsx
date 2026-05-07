import React, { useMemo } from 'react';
import {
    Calendar, Building2, UserCircle, ClipboardCheck,
    Clock, Baby, FileText, ChevronDown, ChevronUp, Filter
} from 'lucide-react';
import type { Filters, Agendamento } from '../types';

interface FilterPanelProps {
    filters: Filters;
    onChange: (filters: Filters) => void;
    agendamentos: Agendamento[];
    unidadeOptions: string[];
    collapsed: boolean;
    onToggleCollapse: () => void;
}



const PERIODO_OPTIONS = ['Manhã', 'Tarde'];



function MultiCheckbox({ label, icon, options, selected, onToggle, selectAll }: {
    label: string;
    icon: React.ReactNode;
    options: string[];
    selected: string[];
    onToggle: (val: string) => void;
    selectAll?: () => void;
}) {
    const allSelected = options.length > 0 && selected.length === options.length;

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                {icon}
                <span>{label}</span>
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1 bg-muted/50 rounded-lg p-2">
                {options.length > 1 && (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground pb-1 border-b border-border mb-1">
                        <input
                            type="checkbox"
                            className="filter-checkbox"
                            checked={allSelected}
                            onChange={() => selectAll?.()}
                        />
                        {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                    </label>
                )}
                {options.map(opt => (
                    <label key={opt} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted rounded px-1 py-0.5">
                        <input
                            type="checkbox"
                            className="filter-checkbox"
                            checked={selected.includes(opt)}
                            onChange={() => onToggle(opt)}
                        />
                        <span className="truncate">{opt}</span>
                    </label>
                ))}
                {options.length === 0 && (
                    <p className="text-xs text-muted-foreground italic py-1">Nenhuma opção</p>
                )}
            </div>
        </div>
    );
}

export default function FilterPanel({ filters, onChange, agendamentos, unidadeOptions, collapsed, onToggleCollapse }: FilterPanelProps) {
    const agendaOptions = useMemo(() => {
        const set = new Set<string>();
        agendamentos.forEach(a => {
            const nome = a.DENTISTA || a.nm_prestador || a.prestador;
            if (nome) set.add(nome);
        });
        return Array.from(set).sort();
    }, [agendamentos]);

    const statusOptions = useMemo(() => {
        const set = new Set<string>();
        agendamentos.forEach(a => {
            const s = a.STATUS || a.ds_status || a.status_agendamento || a.status;
            if (s) set.add(s);
        });
        const fromData = Array.from(set);
        return fromData.sort();
    }, [agendamentos]);

    function toggleItem(key: keyof Filters, val: string) {
        const arr = filters[key] as string[];
        const next = arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
        onChange({ ...filters, [key]: next });
    }

    function toggleAll(key: keyof Filters, options: string[]) {
        const arr = filters[key] as string[];
        const allSelected = arr.length === options.length;
        onChange({ ...filters, [key]: allSelected ? [] : [...options] });
    }

    return (
        <aside className={`glass-card transition-all duration-300 ${collapsed ? 'p-3' : 'p-5'} overflow-y-auto h-[calc(100vh-120px)]`}>
            {/* Header */}
            <button
                onClick={onToggleCollapse}
                className="w-full flex items-center justify-between mb-4 hover:opacity-80"
            >
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center">
                        <Filter className="w-4 h-4 text-white" />
                    </div>
                    {!collapsed && <h2 className="font-bold text-foreground">Filtros</h2>}
                </div>
                {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>

            {!collapsed && (
                <div className="space-y-5 animate-slide-up">

                    {/* Agendas */}
                    <MultiCheckbox
                        label="Agendas (Profissionais)"
                        icon={<UserCircle className="w-4 h-4 text-info" />}
                        options={agendaOptions}
                        selected={filters.agendas}
                        onToggle={val => toggleItem('agendas', val)}
                        selectAll={() => toggleAll('agendas', agendaOptions)}
                    />

                    {/* Status */}
                    <MultiCheckbox
                        label="Status do Agendamento"
                        icon={<ClipboardCheck className="w-4 h-4 text-warning" />}
                        options={statusOptions}
                        selected={filters.statusAgendamento}
                        onToggle={val => toggleItem('statusAgendamento', val)}
                        selectAll={() => toggleAll('statusAgendamento', statusOptions)}
                    />

                    {/* Período */}
                    <MultiCheckbox
                        label="Período"
                        icon={<Clock className="w-4 h-4 text-accent" />}
                        options={PERIODO_OPTIONS}
                        selected={filters.periodos}
                        onToggle={val => toggleItem('periodos', val)}
                        selectAll={() => toggleAll('periodos', PERIODO_OPTIONS)}
                    />


                    {/* Motivo */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            <span>Motivo</span>
                        </div>
                        <input
                            type="text"
                            placeholder="Filtrar por motivo..."
                            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                            value={filters.motivo}
                            onChange={e => onChange({ ...filters, motivo: e.target.value })}
                        />
                    </div>
                </div>
            )}
        </aside>
    );
}

