import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Search, RefreshCw, Download, X, Info } from 'lucide-react';
import { auditService, AuditLogItem, AuditStatsResponse } from '../../services/auditService';

export default function AuditLogManagement() {
    const navigate = useNavigate();
    const [logs, setLogs] = useState<AuditLogItem[]>([]);
    const [stats, setStats] = useState<AuditStatsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    // Filters
    const [search, setSearch] = useState('');
    const [action, setAction] = useState('');
    const [resource, setResource] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Detail Modal
    const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

    const loadData = async (targetPage = page) => {
        setIsLoading(true);
        try {
            const [logsRes, statsRes] = await Promise.all([
                auditService.getLogs({
                    page: targetPage,
                    limit: 20,
                    search: search.trim() || undefined,
                    action: action || undefined,
                    resource: resource || undefined,
                    startDate: startDate || undefined,
                    endDate: endDate || undefined,
                }),
                auditService.getStats().catch(() => null),
            ]);

            setLogs(logsRes.data || []);
            setTotalPages(logsRes.pagination.totalPages || 1);
            setTotalItems(logsRes.pagination.total || 0);
            if (statsRes) setStats(statsRes);
        } catch (error) {
            console.error('Erro ao carregar logs de auditoria:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData(1);
    }, [action, resource]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        loadData(1);
    };

    const handleClearFilters = () => {
        setSearch('');
        setAction('');
        setResource('');
        setStartDate('');
        setEndDate('');
        setPage(1);
        setTimeout(() => loadData(1), 0);
    };

    const handleExportCSV = () => {
        if (!logs.length) return;

        const headers = ['Data/Hora', 'Usuário', 'Email', 'Ação', 'Recurso', 'ID Recurso', 'IP', 'Detalhes'];
        const rows = logs.map(l => [
            new Date(l.createdAt).toLocaleString('pt-BR'),
            l.userName || 'Sistema',
            l.userEmail || '-',
            l.action,
            l.resource,
            l.resourceId || '-',
            l.ipAddress || '-',
            l.details ? JSON.stringify(l.details).replace(/"/g, '""') : '-'
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF'
            + [headers.join(','), ...rows.map(r => `"${r.join('","')}"`)].join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `auditoria_ortho_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getActionBadge = (act: string) => {
        switch (act) {
            case 'LOGIN':
                return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">LOGIN</span>;
            case 'LOGIN_FAILED':
                return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">FALHA LOGIN</span>;
            case 'CREATE':
                return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">CRIAÇÃO</span>;
            case 'READ':
                return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-300 border border-slate-500/20">VISUALIZAÇÃO</span>;
            case 'UPDATE':
                return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">EDIÇÃO</span>;
            case 'DELETE':
                return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">EXCLUSÃO</span>;
            case 'EXPORT':
                return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-teal-500/10 text-teal-400 border border-teal-500/20">EXPORTAÇÃO</span>;
            default:
                return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-sidebar-border text-sidebar-foreground/70">{act}</span>;
        }
    };

    return (
        <div className="min-h-screen bg-sidebar">
            {/* Header */}
            <header className="border-b border-sidebar-border bg-sidebar-accent/50 backdrop-blur-sm sticky top-0 z-20">
                <div className="container mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition"
                            title="Voltar ao Painel"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-sidebar-foreground">Logs de Auditoria & Acesso</h1>
                                <p className="text-sidebar-foreground/60 text-sm">Trilha de conformidade LGPD e ações no prontuário</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => loadData(page)}
                            className="p-2 bg-sidebar-accent/50 hover:bg-sidebar-accent text-sidebar-foreground/80 rounded-lg border border-sidebar-border transition"
                            title="Recarregar"
                        >
                            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={handleExportCSV}
                            className="flex items-center gap-2 px-3 py-2 bg-sidebar-accent hover:bg-sidebar-accent/80 text-sidebar-foreground border border-sidebar-border rounded-lg text-sm font-medium transition"
                        >
                            <Download className="w-4 h-4 text-emerald-400" />
                            Exportar CSV
                        </button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-6 py-8 space-y-6">
                {/* KPI Cards */}
                {stats?.last24h && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-sidebar-accent/30 border border-sidebar-border rounded-xl p-5">
                            <span className="text-xs uppercase text-sidebar-foreground/60 font-medium">Ações (Últimas 24h)</span>
                            <div className="text-3xl font-bold text-sidebar-foreground mt-2">{stats.last24h.total}</div>
                            <span className="text-xs text-sidebar-foreground/50 mt-1 block">Volume total de requisições auditadas</span>
                        </div>
                        <div className="bg-sidebar-accent/30 border border-sidebar-border rounded-xl p-5">
                            <span className="text-xs uppercase text-sidebar-foreground/60 font-medium">Logins Realizados (24h)</span>
                            <div className="text-3xl font-bold text-emerald-400 mt-2">{stats.last24h.logins}</div>
                            <span className="text-xs text-sidebar-foreground/50 mt-1 block">Autenticações com sucesso</span>
                        </div>
                        <div className="bg-sidebar-accent/30 border border-sidebar-border rounded-xl p-5">
                            <span className="text-xs uppercase text-sidebar-foreground/60 font-medium">Operações em Pacientes (24h)</span>
                            <div className="text-3xl font-bold text-sky-400 mt-2">{stats.last24h.patientActions}</div>
                            <span className="text-xs text-sidebar-foreground/50 mt-1 block">Visualizações, edições e cadastros</span>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="bg-sidebar-accent/30 border border-sidebar-border rounded-xl p-4 space-y-3">
                    <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                        <div className="md:col-span-4 relative">
                            <Search className="w-4 h-4 absolute left-3 top-3 text-sidebar-foreground/40" />
                            <input
                                type="text"
                                placeholder="Buscar por usuário, email, ID ou IP..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full bg-sidebar border border-sidebar-border rounded-lg pl-9 pr-3 py-2 text-sm text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus:outline-none focus:border-emerald-500"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <select
                                value={action}
                                onChange={(e) => { setAction(e.target.value); setPage(1); }}
                                className="w-full bg-sidebar border border-sidebar-border rounded-lg px-3 py-2 text-sm text-sidebar-foreground focus:outline-none focus:border-emerald-500"
                            >
                                <option value="">Todas as Ações</option>
                                <option value="LOGIN">LOGIN</option>
                                <option value="LOGIN_FAILED">FALHA LOGIN</option>
                                <option value="CREATE">CRIAÇÃO</option>
                                <option value="READ">VISUALIZAÇÃO</option>
                                <option value="UPDATE">EDIÇÃO</option>
                                <option value="DELETE">EXCLUSÃO</option>
                                <option value="EXPORT">EXPORTAÇÃO</option>
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <select
                                value={resource}
                                onChange={(e) => { setResource(e.target.value); setPage(1); }}
                                className="w-full bg-sidebar border border-sidebar-border rounded-lg px-3 py-2 text-sm text-sidebar-foreground focus:outline-none focus:border-emerald-500"
                            >
                                <option value="">Todos os Recursos</option>
                                <option value="AUTH">AUTH</option>
                                <option value="PATIENT">PACIENTE</option>
                                <option value="PLANNING">PLANEJAMENTO</option>
                                <option value="CONTRACT">CONTRATO</option>
                                <option value="USER">USUÁRIO</option>
                                <option value="CLINIC">CLÍNICA</option>
                            </select>
                        </div>

                        <div className="md:col-span-3 flex items-center gap-2">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-1/2 bg-sidebar border border-sidebar-border rounded-lg px-2 py-2 text-xs text-sidebar-foreground focus:outline-none focus:border-emerald-500"
                                title="Data inicial"
                            />
                            <span className="text-sidebar-foreground/40 text-xs">até</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-1/2 bg-sidebar border border-sidebar-border rounded-lg px-2 py-2 text-xs text-sidebar-foreground focus:outline-none focus:border-emerald-500"
                                title="Data final"
                            />
                        </div>

                        <div className="md:col-span-1 flex items-center gap-1 justify-end">
                            <button
                                type="submit"
                                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition"
                            >
                                Filtrar
                            </button>
                            {(search || action || resource || startDate || endDate) && (
                                <button
                                    type="button"
                                    onClick={handleClearFilters}
                                    className="p-2 text-sidebar-foreground/60 hover:text-sidebar-foreground rounded-lg"
                                    title="Limpar filtros"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* Table */}
                <div className="bg-sidebar-accent/30 backdrop-blur-xl rounded-xl border border-sidebar-border overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sidebar-foreground/80">
                            <thead className="bg-sidebar-accent/50 text-sidebar-foreground/60 uppercase text-xs font-semibold">
                                <tr>
                                    <th className="px-6 py-4">Data / Hora</th>
                                    <th className="px-6 py-4">Usuário</th>
                                    <th className="px-6 py-4">Ação</th>
                                    <th className="px-6 py-4">Recurso</th>
                                    <th className="px-6 py-4">IP / Origem</th>
                                    <th className="px-6 py-4 text-right">Detalhes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-sidebar-border/50 text-sm">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-sidebar-foreground/60">
                                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-400 mb-2"></div>
                                            <div>Carregando logs de auditoria...</div>
                                        </td>
                                    </tr>
                                ) : logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-sidebar-foreground/60">
                                            Nenhum registro de auditoria encontrado com os filtros aplicados.
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-sidebar-accent/30 transition">
                                            <td className="px-6 py-4 whitespace-nowrap text-xs text-sidebar-foreground/60">
                                                {new Date(log.createdAt).toLocaleString('pt-BR')}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-sidebar-foreground">{log.userName || 'Sistema'}</div>
                                                <div className="text-xs text-sidebar-foreground/50">{log.userEmail || '-'}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {getActionBadge(log.action)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="font-mono text-xs px-2 py-0.5 rounded bg-sidebar-border/50 text-sidebar-foreground/90">
                                                    {log.resource}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-sidebar-foreground/60">
                                                {log.ipAddress || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => setSelectedLog(log)}
                                                    className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium px-2 py-1 rounded hover:bg-emerald-500/10 transition"
                                                >
                                                    <Info className="w-3.5 h-3.5" />
                                                    Inspecionar
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="px-6 py-4 border-t border-sidebar-border bg-sidebar-accent/20 flex items-center justify-between text-xs text-sidebar-foreground/60">
                        <div>
                            Total: <strong className="text-sidebar-foreground">{totalItems}</strong> registros
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                disabled={page <= 1 || isLoading}
                                onClick={() => {
                                    const prev = page - 1;
                                    setPage(prev);
                                    loadData(prev);
                                }}
                                className="px-3 py-1.5 rounded border border-sidebar-border bg-sidebar hover:bg-sidebar-accent disabled:opacity-40 transition"
                            >
                                Anterior
                            </button>
                            <span>Página {page} de {totalPages || 1}</span>
                            <button
                                disabled={page >= totalPages || isLoading}
                                onClick={() => {
                                    const next = page + 1;
                                    setPage(next);
                                    loadData(next);
                                }}
                                className="px-3 py-1.5 rounded border border-sidebar-border bg-sidebar hover:bg-sidebar-accent disabled:opacity-40 transition"
                            >
                                Próxima
                            </button>
                        </div>
                    </div>
                </div>
            </main>

            {/* Modal de Detalhes do Log */}
            {selectedLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-sidebar border border-sidebar-border rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-sidebar-border flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                                <h3 className="font-semibold text-sidebar-foreground">Detalhes da Ação Auditada</h3>
                            </div>
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="text-sidebar-foreground/50 hover:text-sidebar-foreground p-1 rounded"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-4 text-sm">
                            <div className="grid grid-cols-2 gap-4 bg-sidebar-accent/30 p-4 rounded-lg border border-sidebar-border">
                                <div>
                                    <span className="text-xs text-sidebar-foreground/50 block">ID do Registro</span>
                                    <span className="font-mono text-xs text-sidebar-foreground select-all">{selectedLog.id}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-sidebar-foreground/50 block">Data / Hora</span>
                                    <span className="text-sidebar-foreground">{new Date(selectedLog.createdAt).toLocaleString('pt-BR')}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-sidebar-foreground/50 block">Ação</span>
                                    <div>{getActionBadge(selectedLog.action)}</div>
                                </div>
                                <div>
                                    <span className="text-xs text-sidebar-foreground/50 block">Recurso</span>
                                    <span className="font-mono text-sidebar-foreground">{selectedLog.resource} {selectedLog.resourceId ? `(${selectedLog.resourceId})` : ''}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-sidebar-foreground/50 block">Usuário</span>
                                    <span className="text-sidebar-foreground">{selectedLog.userName || 'Sistema'} ({selectedLog.userEmail || '-'})</span>
                                </div>
                                <div>
                                    <span className="text-xs text-sidebar-foreground/50 block">IP do Cliente</span>
                                    <span className="font-mono text-xs text-sidebar-foreground">{selectedLog.ipAddress || '-'}</span>
                                </div>
                            </div>

                            {selectedLog.userAgent && (
                                <div>
                                    <span className="text-xs text-sidebar-foreground/50 block mb-1">User-Agent</span>
                                    <div className="p-2.5 rounded bg-sidebar-accent/20 border border-sidebar-border font-mono text-xs text-sidebar-foreground/70 break-all">
                                        {selectedLog.userAgent}
                                    </div>
                                </div>
                            )}

                            <div>
                                <span className="text-xs text-sidebar-foreground/50 block mb-1">Metadados & Payload de Alterações (JSON)</span>
                                <pre className="p-4 rounded-lg bg-black/40 border border-sidebar-border font-mono text-xs text-emerald-300 overflow-x-auto max-h-60">
                                    {selectedLog.details ? JSON.stringify(selectedLog.details, null, 2) : '// Sem detalhes adicionais'}
                                </pre>
                            </div>
                        </div>

                        <div className="px-6 py-3 border-t border-sidebar-border bg-sidebar-accent/20 flex justify-end">
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="px-4 py-2 bg-sidebar-accent hover:bg-sidebar-accent/80 text-sidebar-foreground rounded-lg text-sm font-medium transition"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
