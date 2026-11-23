import prisma from '../lib/prisma';
import { syncTreatmentAppointments, SyncResult } from './appointmentSync';

export type SyncTrigger = 'cron' | 'catchup' | 'manual';

let running = false;

// Executa a sincronizacao global e registra a execucao em SyncRun, para que a tela do
// portal mostre se rodou, quando e com qual resultado. Nunca roda duas ao mesmo tempo.
export async function runLoggedSync(trigger: SyncTrigger): Promise<{ started: boolean; runId?: string }> {
    if (running) return { started: false };
    running = true;

    const startedAt = Date.now();
    let runId: string | undefined;
    try {
        const run = await prisma.syncRun.create({ data: { trigger, status: 'running' } });
        runId = run.id;

        const result: SyncResult = await syncTreatmentAppointments();
        // Nada vindo do EasyDental com tratamentos em andamento = quase certamente falha da API
        const suspicious = result.fetched === 0 && result.candidates > 0;
        const complete = result.easyDentalComplete && !suspicious;

        await prisma.syncRun.update({
            where: { id: run.id },
            data: {
                status: complete ? 'completed' : 'partial',
                finishedAt: new Date(),
                durationMs: Date.now() - startedAt,
                fetched: result.fetched,
                candidates: result.candidates,
                matched: result.matched,
                updated: result.updated,
                unmatched: result.unmatched,
                easyDentalComplete: complete,
                errorMessage: complete
                    ? null
                    : 'O EasyDental respondeu de forma incompleta (alguma unidade falhou ou nenhum registro foi retornado). Veja os logs do backend.',
            },
        });
        console.log(
            `[SyncRun] ${trigger} ${complete ? 'ok' : 'PARCIAL'}: ${result.updated} atualizados, ` +
            `${result.matched} com match, ${result.unmatched} sem match, ${result.fetched} registros da API.`
        );
        return { started: true, runId };
    } catch (error: any) {
        console.error('[SyncRun] falhou:', error.message);
        if (runId) {
            await prisma.syncRun
                .update({
                    where: { id: runId },
                    data: {
                        status: 'failed',
                        finishedAt: new Date(),
                        durationMs: Date.now() - startedAt,
                        easyDentalComplete: false,
                        errorMessage: String(error.message || error).slice(0, 1000),
                    },
                })
                .catch(() => undefined);
        }
        return { started: true, runId };
    } finally {
        running = false;
    }
}

export const isSyncRunning = () => running;

// Existe execucao concluida (completa) desde `since`?
export async function hasCompletedRunSince(since: Date): Promise<boolean> {
    const count = await prisma.syncRun.count({
        where: { status: 'completed', startedAt: { gte: since } },
    });
    return count > 0;
}
