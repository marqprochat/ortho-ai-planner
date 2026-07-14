import React from 'react';
import { CheckCircle, XCircle, Loader2, Clock, Phone, User, Building2, Calendar } from 'lucide-react';
import type { MessageItem, MessageStatus } from '../types';

interface MessageTableProps {
    messages: MessageItem[];
    selectedIds: Set<string>;
    onToggleSelect: (id: string) => void;
    onSelectAll: () => void;
    isSending: boolean;
    isUltimaConsulta?: boolean;
    isAniversario?: boolean;
    loading?: boolean;
}

function formatSimpleDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    try {
        const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
            return `${match[3]}/${match[2]}/${match[1]}`;
        }
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        return `${day}/${month}/${year}`;
    } catch {
        return dateStr;
    }
}

function calculateAge(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    try {
        const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!match) {
            // Also handle DD/MM/YYYY if applicable
            const matchDMY = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
            if (matchDMY) {
                const birthYear = parseInt(matchDMY[3]);
                const currentYear = new Date().getFullYear();
                if (birthYear > 1900 && birthYear <= currentYear) {
                    return `${currentYear - birthYear} anos`;
                }
            }
            return '';
        }
        const birthYear = parseInt(match[1]);
        const currentYear = new Date().getFullYear();
        if (birthYear > 1900 && birthYear <= currentYear) {
            return `${currentYear - birthYear} anos`;
        }
    } catch {}
    return '';
}

function StatusBadge({ status, error }: { status: MessageStatus; error?: string }) {
    const config: Record<MessageStatus, { label: string; class: string; icon: React.ReactNode }> = {
        pending: { label: 'Pendente', class: 'badge-pending', icon: <Clock className="w-3 h-3" /> },
        sending: { label: 'Enviando...', class: 'badge-sending animate-pulse-ring', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
        sent: { label: 'Enviado', class: 'badge-sent', icon: <CheckCircle className="w-3 h-3" /> },
        error: { label: error || 'Erro', class: 'badge-error', icon: <XCircle className="w-3 h-3" /> },
    };
    const c = config[status];

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.class}`} title={error}>
            {c.icon}
            {c.label}
        </span>
    );
}

export default function MessageTable({ messages, selectedIds, onToggleSelect, onSelectAll, isSending, isUltimaConsulta, isAniversario, loading }: MessageTableProps) {
    const allSelected = messages.length > 0 && selectedIds.size === messages.filter(m => m.status === 'pending').length;
    const stats = {
        total: messages.length,
        pending: messages.filter(m => m.status === 'pending').length,
        sent: messages.filter(m => m.status === 'sent').length,
        error: messages.filter(m => m.status === 'error').length,
        sending: messages.filter(m => m.status === 'sending').length,
    };

    return (
        <div className="glass-card overflow-hidden">
            {/* Stats bar */}
            {loading ? (
                <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/30">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm font-medium text-foreground">
                        Buscando pacientes na base de dados...
                    </span>
                </div>
            ) : messages.length > 0 && (
                <div className="flex items-center gap-4 px-5 py-3 border-b border-border bg-muted/30">
                    <span className="text-sm font-medium text-foreground">
                        {stats.total} destinatário{stats.total !== 1 ? 's' : ''}
                    </span>
                    <div className="flex items-center gap-3 ml-auto text-xs">
                        {stats.pending > 0 && (
                            <span className="flex items-center gap-1 text-yellow-600">
                                <Clock className="w-3 h-3" /> {stats.pending} pendente{stats.pending !== 1 ? 's' : ''}
                            </span>
                        )}
                        {stats.sending > 0 && (
                            <span className="flex items-center gap-1 text-blue-600">
                                <Loader2 className="w-3 h-3 animate-spin" /> {stats.sending} enviando
                            </span>
                        )}
                        {stats.sent > 0 && (
                            <span className="flex items-center gap-1 text-emerald-600">
                                <CheckCircle className="w-3 h-3" /> {stats.sent} enviado{stats.sent !== 1 ? 's' : ''}
                            </span>
                        )}
                        {stats.error > 0 && (
                            <span className="flex items-center gap-1 text-red-600">
                                <XCircle className="w-3 h-3" /> {stats.error} erro{stats.error !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-muted/50 border-b border-border">
                            <th className="w-10 px-3 py-3">
                                <input
                                    type="checkbox"
                                    className="filter-checkbox"
                                    checked={allSelected}
                                    onChange={onSelectAll}
                                    disabled={isSending}
                                />
                            </th>
                            <th className="px-3 py-3 text-left font-semibold text-foreground/70">
                                <div className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> Destinatário</div>
                            </th>
                            <th className="px-3 py-3 text-left font-semibold text-foreground/70">
                                <div className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> Paciente</div>
                            </th>
                            <th className="px-3 py-3 text-left font-semibold text-foreground/70">
                                <div className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {isAniversario ? 'Data Nascimento' : isUltimaConsulta ? 'Última Consulta' : 'Data'}
                                </div>
                            </th>
                            <th className="px-3 py-3 text-left font-semibold text-foreground/70">
                                <div className="flex items-center gap-1">
                                    {isAniversario ? (
                                        <>
                                            <Calendar className="w-3.5 h-3.5" />
                                            <span>Idade</span>
                                        </>
                                    ) : isUltimaConsulta ? (
                                        <>
                                            <Calendar className="w-3.5 h-3.5" />
                                            <span>Consulta Agendada</span>
                                        </>
                                    ) : (
                                        <>
                                            <Clock className="w-3.5 h-3.5" />
                                            <span>Hora</span>
                                        </>
                                    )}
                                </div>
                            </th>
                            <th className="px-3 py-3 text-left font-semibold text-foreground/70">
                                <div className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> Unidade</div>
                            </th>
                            <th className="px-3 py-3 text-center font-semibold text-foreground/70">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, rowIndex) => (
                                <tr key={`skeleton-${rowIndex}`} className="animate-pulse">
                                    <td className="px-3 py-3.5 text-center">
                                        <div className="w-4 h-4 bg-muted/80 rounded mx-auto" />
                                    </td>
                                    <td className="px-3 py-3.5">
                                        <div className="h-4 bg-muted/80 rounded w-24 mx-auto md:mx-0" />
                                    </td>
                                    <td className="px-3 py-3.5 font-medium">
                                        <div className="h-4 bg-muted/80 rounded w-48" />
                                    </td>
                                    <td className="px-3 py-3.5">
                                        <div className="h-4 bg-muted/80 rounded w-20" />
                                    </td>
                                    <td className="px-3 py-3.5">
                                        <div className="h-4 bg-muted/80 rounded w-16" />
                                    </td>
                                    <td className="px-3 py-3.5">
                                        <div className="h-4 bg-muted/80 rounded w-24" />
                                    </td>
                                    <td className="px-3 py-3.5 text-center">
                                        <div className="w-20 h-6 bg-muted/80 rounded-full mx-auto" />
                                    </td>
                                </tr>
                            ))
                        ) : messages.map((msg, i) => (
                            <tr
                                key={msg.id}
                                className={`transition-colors hover:bg-muted/30 ${
                                    msg.status === 'sent' ? 'bg-emerald-50/50' :
                                    msg.status === 'error' ? 'bg-red-50/50' :
                                    msg.status === 'sending' ? 'bg-blue-50/50' : ''
                                }`}
                                style={{ animationDelay: `${i * 20}ms` }}
                            >
                                <td className="px-3 py-2.5 text-center">
                                    <input
                                        type="checkbox"
                                        className="filter-checkbox"
                                        checked={selectedIds.has(msg.id)}
                                        onChange={() => onToggleSelect(msg.id)}
                                        disabled={isSending || msg.status !== 'pending'}
                                    />
                                </td>
                                <td className="px-3 py-2.5 font-mono text-xs text-foreground/80">
                                    {msg.telefone || <span className="text-red-400 italic">Sem telefone</span>}
                                </td>
                                <td className="px-3 py-2.5 font-medium">{msg.nomeCompleto}</td>
                                <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                                    {isAniversario ? formatSimpleDate(msg.data) : isUltimaConsulta ? formatSimpleDate(msg.ultimaConsulta) : msg.data}
                                </td>
                                <td className="px-3 py-2.5 text-muted-foreground text-xs">
                                    {isAniversario ? (
                                        calculateAge(msg.data) || '-'
                                    ) : isUltimaConsulta ? (
                                        formatSimpleDate(msg.consultaAgendada) || (
                                            <span className="text-muted-foreground/60 italic font-normal">Nenhuma</span>
                                        )
                                    ) : (
                                        msg.hora
                                    )}
                                </td>
                                <td className="px-3 py-2.5 text-muted-foreground text-xs">{msg.unidade}</td>
                                <td className="px-3 py-2.5 text-center">
                                    <StatusBadge status={msg.status} error={msg.errorMessage} />
                                </td>
                            </tr>
                        ))}

                        {!loading && messages.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-6 py-16 text-center">
                                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                                        <Phone className="w-10 h-10 opacity-30" />
                                        <p className="text-sm">Nenhum destinatário encontrado</p>
                                        <p className="text-xs">Configure os filtros e clique em <strong>Pesquisar</strong></p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
