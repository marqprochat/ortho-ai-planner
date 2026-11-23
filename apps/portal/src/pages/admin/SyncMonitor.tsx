import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Play, DatabaseZap } from 'lucide-react';
import { toast } from 'sonner';
import { syncRunService, SyncRunItem, SyncRunsResponse } from '../../services/syncRunService';

const statusBadge = (status: SyncRunItem['status']) => {
    const map = {
        running: ['EXECUTANDO', 'bg-sky-500/10 text-sky-400 border-sky-500/20'],
        completed: ['CONCLUÍDA', 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'],
        partial: ['PARCIAL', 'bg-amber-500/10 text-amber-400 border-amber-500/20'],
        failed: ['FALHOU', 'bg-rose-500/10 text-rose-400 border-rose-500/20'],
    } as const;
    const [label, cls] = map[status];
    return <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${cls}`}>{label}</span>;
};

const triggerLabel: Record<SyncRunItem['trigger'], string> = {
    cron: 'Agendada (05:00)',
    catchup: 'Recuperação',
    manual: 'Manual',
};

const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-';

const brtDay = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

export default function SyncMonitor() {
    const navigate = useNavigate();
    const [data, setData] = useState<SyncRunsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [triggering, setTriggering] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            setData(await syncRunService.list(30));
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    // Enquanto houver execucao em andamento, atualiza sozinho
    useEffect(() => {
        if (!data?.running) return;
        const t = setInterval(load, 5000);
        return () => clearInterval(t);
    }, [data?.running]);

    const handleTrigger = async () => {
        setTriggering(true);
        try {
            await syncRunService.trigger();
            toast.success('Sincronização iniciada');
            setTimeout(load, 1500);
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setTriggering(false);
        }
    };

    const runs = data?.runs ?? [];
    const lastOk = runs.find((r) => r.status === 'completed');
    const todayBrt = brtDay(new Date().toISOString());
    const okToday = !!lastOk && brtDay(lastOk.startedAt) === todayBrt;

    return (
        <div className="min-h-screen bg-sidebar">
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
                            <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400">
                                <DatabaseZap className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-sidebar-foreground">Sincronização EasyDental</h1>
                                <p className="text-sidebar-foreground/60 text-sm">
                                    Atualização diária das consultas dos tratamentos · programada {data?.schedule ?? '05:00'}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={load}
                            className="p-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition"
                            title="Atualizar"
                        >
                            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={handleTrigger}
                            disabled={triggering || data?.running}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                        >
                            <Play className="w-4 h-4" />
                            {data?.running ? 'Em execução...' : 'Sincronizar agora'}
                        </button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-6 py-8">
                <div
                    className={`mb-6 rounded-xl border p-4 text-sm ${
                        okToday
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                    }`}
                >
                    {okToday
                        ? `Sincronização de hoje concluída em ${fmt(lastOk!.finishedAt)}.`
                        : lastOk
                            ? `Sem sincronização completa hoje. Última concluída: ${fmt(lastOk.finishedAt)}.`
                            : 'Nenhuma sincronização completa registrada ainda.'}
                </div>

                <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/30 overflow-x-auto">
                    <table className="w-full text-sm text-sidebar-foreground">
                        <thead>
                            <tr className="text-left text-sidebar-foreground/60 border-b border-sidebar-border">
                                <th className="p-3">Início</th>
                                <th className="p-3">Origem</th>
                                <th className="p-3">Status</th>
                                <th className="p-3 text-right">Duração</th>
                                <th className="p-3 text-right">Registros API</th>
                                <th className="p-3 text-right">Tratamentos</th>
                                <th className="p-3 text-right">Com match</th>
                                <th className="p-3 text-right">Atualizados</th>
                                <th className="p-3 text-right">Sem match</th>
                                <th className="p-3">Detalhe</th>
                            </tr>
                        </thead>
                        <tbody>
                            {runs.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={10} className="p-6 text-center text-sidebar-foreground/60">
                                        Nenhuma execução registrada. As próximas serão listadas aqui.
                                    </td>
                                </tr>
                            )}
                            {runs.map((r) => (
                                <tr key={r.id} className="border-b border-sidebar-border/50">
                                    <td className="p-3 whitespace-nowrap">{fmt(r.startedAt)}</td>
                                    <td className="p-3">{triggerLabel[r.trigger]}</td>
                                    <td className="p-3">{statusBadge(r.status)}</td>
                                    <td className="p-3 text-right">{r.durationMs != null ? `${(r.durationMs / 1000).toFixed(1)}s` : '-'}</td>
                                    <td className="p-3 text-right">{r.fetched}</td>
                                    <td className="p-3 text-right">{r.candidates}</td>
                                    <td className="p-3 text-right">{r.matched}</td>
                                    <td className="p-3 text-right">{r.updated}</td>
                                    <td className="p-3 text-right">{r.unmatched}</td>
                                    <td className="p-3 text-sidebar-foreground/70 max-w-xs">{r.errorMessage ?? ''}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}
