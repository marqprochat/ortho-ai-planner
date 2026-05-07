import React from 'react';
import { CheckCircle, XCircle, Loader2, Clock, Phone, User, Building2, Calendar } from 'lucide-react';
import type { MessageItem, MessageStatus } from '../types';

interface MessageTableProps {
    messages: MessageItem[];
    selectedIds: Set<string>;
    onToggleSelect: (id: string) => void;
    onSelectAll: () => void;
    isSending: boolean;
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

export default function MessageTable({ messages, selectedIds, onToggleSelect, onSelectAll, isSending }: MessageTableProps) {
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
            {messages.length > 0 && (
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
                                <div className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Data</div>
                            </th>
                            <th className="px-3 py-3 text-left font-semibold text-foreground/70">
                                <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Hora</div>
                            </th>
                            <th className="px-3 py-3 text-left font-semibold text-foreground/70">
                                <div className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> Unidade</div>
                            </th>
                            <th className="px-3 py-3 text-center font-semibold text-foreground/70">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {messages.map((msg, i) => (
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
                                <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">{msg.data}</td>
                                <td className="px-3 py-2.5 text-muted-foreground text-xs">{msg.hora}</td>
                                <td className="px-3 py-2.5 text-muted-foreground text-xs">{msg.unidade}</td>
                                <td className="px-3 py-2.5 text-center">
                                    <StatusBadge status={msg.status} error={msg.errorMessage} />
                                </td>
                            </tr>
                        ))}

                        {messages.length === 0 && (
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
