import cron from 'node-cron';
import { hasCompletedRunSince, runLoggedSync } from '../services/syncRunLogger';

const TIMEZONE = 'America/Sao_Paulo';
const SCHEDULED_HOUR_BRT = 5;

// Inicio (em UTC) das 05:00 de hoje no horario de Sao Paulo (UTC-3, sem horario de verao desde 2019).
const todayScheduledInstant = () => {
    const now = new Date();
    const brt = new Date(now.getTime() - 3 * 3600 * 1000);
    return new Date(Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate(), SCHEDULED_HOUR_BRT + 3));
};

// Roda apenas se a execucao programada de hoje nao concluiu com sucesso.
const ensureTodayRun = async (trigger: 'cron' | 'catchup') => {
    const since = todayScheduledInstant();
    if (new Date() < since) return;
    try {
        if (await hasCompletedRunSince(since)) return;
        console.log(`[AppointmentSyncCron] Sem execucao completa hoje, iniciando (${trigger})...`);
        await runLoggedSync(trigger);
    } catch (error: any) {
        console.error('[AppointmentSyncCron] erro:', error.message);
    }
};

// Sincroniza diariamente as datas de ultima/proxima consulta dos tratamentos
// em andamento com a agenda do EasyDental (RPCGetUltimaConsulta).
export const initAppointmentSyncCron = () => {
    // Todo dia as 05:00 (horario de Sao Paulo, independente do fuso do servidor)
    cron.schedule('0 5 * * *', () => {
        console.log('Running daily treatment appointment sync...');
        runLoggedSync('cron').catch((e) => console.error('[AppointmentSyncCron] erro:', e.message));
    }, { timezone: TIMEZONE });

    // Reforco: se a das 05:00 falhou ou foi parcial (ex.: API hibernando), tenta de novo.
    cron.schedule('0 7,9,12 * * *', () => { void ensureTodayRun('catchup'); }, { timezone: TIMEZONE });

    // Servidor/container que ficou fora do ar as 05:00: recupera ao subir.
    setTimeout(() => { void ensureTodayRun('catchup'); }, 60_000);

    console.log('[AppointmentSyncCron] agendado: 05:00 America/Sao_Paulo + reforcos 07/09/12h + recuperacao ao iniciar');
};
