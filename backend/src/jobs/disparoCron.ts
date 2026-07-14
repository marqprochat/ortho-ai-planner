import cron from 'node-cron';
import prisma from '../lib/prisma';
import type { ScheduledDisparo } from '@prisma/client';

const EASYDENTAL_API_URL = process.env.EASYDENTAL_API_URL || 'https://prsrb.onrender.com/v1/rpc';
const EASYDENTAL_API_KEY = process.env.EASYDENTAL_API_KEY || '';
const EASYDENTAL_CLIENT_ID = process.env.EASYDENTAL_CLIENT_ID || '';
const BOTCONVERSA_URL = process.env.BOTCONVERSA_WEBHOOK_URL || '';

// Active cron tasks indexed by schedule id
const activeTasks = new Map<string, ReturnType<typeof cron.schedule>>();

function offsetDate(daysOffset: number): string {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

async function rpcCall(method: string, params: Record<string, any> = {}) {
    const res = await fetch(EASYDENTAL_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': EASYDENTAL_API_KEY },
        body: JSON.stringify({ clientId: EASYDENTAL_CLIENT_ID, method, params }),
    });
    if (!res.ok) throw new Error(`RPC ${method} failed (${res.status})`);
    return res.json();
}

function extractPhone(ag: any): string {
    const raw = (ag.CELULAR || ag.nr_celular || ag.nr_fone || ag.telefone || ag.celular || ag.fone || ag.nr_fone_celular || ag.celular_paciente || '').toString();
    if (!raw) return '';
    let digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length >= 11 && digits.startsWith('0')) digits = digits.substring(1);
    if (digits.startsWith('55') && digits.length >= 12) return `+${digits}`;
    return `+55${digits}`;
}

function extractUnit(ag: any): string {
    return ag.UNIDADE || ag.TX_UNIDADE_ATENDIMENTO || ag.nm_unidade || ag.unidade || ag.NM_UNIDADE_ATENDIMENTO || '';
}

// Maps schedule status codes (stored in DB) to all possible API return values
const STATUS_ALIASES: Record<string, string[]> = {
    AEX: ['AEX', 'Agendado externo'],
    AGD: ['AGD', 'Agendado'],
    AGP: ['AGP', 'Aguardando confirmação profissional', 'Aguardando confirmacao profissional'],
    AGU: ['AGU', 'Aguardando confirmação paciente', 'Aguardando confirmacao paciente'],
    ATE: ['ATE', 'Atendido'],
    CON: ['CON', 'Confirmado'],
    DCA: ['DCA', 'Desmarcado pelo Paciente'],
    DPP: ['DPP', 'Desmarcado pelo Dentista'],
    FAL: ['FAL', 'Faltou'],
    MDA: ['MDA', 'Mudar horario (desmarcar)'],
    NAT: ['NAT', 'Não atendido', 'Nao atendido'],
    PRE: ['PRE', 'Pré Agendado', 'Pre Agendado'],
    RCP: ['RCP', 'Recepção', 'Recepcao'],
};

function statusMatchesFilter(apiStatus: string, configuredStatuses: string[]): boolean {
    return configuredStatuses.some(cfg => {
        if (apiStatus === cfg) return true;
        const aliases = STATUS_ALIASES[cfg];
        return aliases ? aliases.some(a => a.toLowerCase() === apiStatus.toLowerCase()) : false;
    });
}

function extractStatus(ag: any): string {
    return ag.STATUS || ag.ds_status || ag.status_agendamento || ag.status || '';
}

function extractProvider(ag: any): string {
    return ag.DENTISTA || ag.nm_prestador || ag.prestador || '';
}

function getTimeSlot(ag: any): string {
    const hour = ag.INICIO || ag.hr_agendamento || ag.hora || '';
    const h = parseInt(hour.split(':')[0], 10);
    if (isNaN(h)) return '';
    return h < 12 ? 'Manhã' : 'Tarde';
}

function getFirstName(fullName: string): string {
    return (fullName || '').trim().split(/\s+/)[0] || '';
}

function formatAgendamento(data: string, hora: string): string {
    if (!data || !hora) return '';
    let dateObj: Date;
    let formattedDate = data;

    if (data.includes('-')) {
        const [y, m, d] = data.split('-');
        dateObj = new Date(Number(y), Number(m) - 1, Number(d));
        formattedDate = `${d}/${m}/${y}`;
    } else if (data.includes('/')) {
        const [d, m, y] = data.split('/');
        dateObj = new Date(Number(y), Number(m) - 1, Number(d));
        formattedDate = `${d}/${m}/${y}`;
    } else {
        return `${data} às ${hora}`;
    }

    const days = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
    return `${days[dateObj.getDay()]} ${formattedDate} às ${hora}`;
}

async function sendViaBotConversa(payload: Record<string, string>): Promise<void> {
    const res = await fetch(BOTCONVERSA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (res.status !== 200) {
        const text = await res.text();
        throw new Error(`BotConversa ${res.status}: ${text}`);
    }
}

export async function executeScheduledDisparo(schedule: ScheduledDisparo): Promise<void> {
    const dtInicio = offsetDate(schedule.dtInicioOffset);
    const dtTermino = offsetDate(schedule.dtTerminoOffset);

    console.log(`[DisparoCron] Running "${schedule.name}" (${schedule.id}) — ${dtInicio} to ${dtTermino}`);

    const log = await prisma.scheduledDisparoLog.create({
        data: {
            scheduleId: schedule.id,
            status: 'running',
            dtInicio,
            dtTermino,
        },
    });

    let totalFetched = 0;
    let totalSent = 0;
    let totalErrors = 0;
    let totalProcessed = 0;

    try {
        // Fetch agendamentos from EasyDental
        let agendamentos: any[] = [];

        if (schedule.searchMode === 'aniversario') {
            // Birthday RPC query format MM-DD
            const formatToMMDD = (dateStr: string) => {
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                    return dateStr.substring(5); // "YYYY-MM-DD" -> "MM-DD"
                }
                return dateStr;
            };
            const dtInicioFormatted = formatToMMDD(dtInicio);
            const dtTerminoFormatted = formatToMMDD(dtTermino);

            if (schedule.unidades.length > 0) {
                const results = await Promise.all(
                    schedule.unidades.map((nm_unidade: string) =>
                        rpcCall('RPCGetAniversarios', { dt_inicio: dtInicioFormatted, dt_termino: dtTerminoFormatted, nm_unidade })
                            .then(d => (Array.isArray(d) ? d : [d]))
                            .catch(() => [])
                    )
                );
                agendamentos = results.flat();
            } else {
                let targetUnits: string[] = [];
                try {
                    const unitsData = await rpcCall('RPCGetUnidadeAtendimento');
                    if (Array.isArray(unitsData)) {
                        targetUnits = unitsData
                            .map((u: any) => u.TX_UNIDADE_ATENDIMENTO)
                            .filter((name: any) => typeof name === 'string' && name.trim() !== '');
                    }
                } catch (err: any) {
                    console.error('[DisparoCron] Error fetching units fallback for Aniversario:', err.message);
                }

                if (targetUnits.length > 0) {
                    const results = await Promise.all(
                        targetUnits.map((nm_unidade: string) =>
                            rpcCall('RPCGetAniversarios', { dt_inicio: dtInicioFormatted, dt_termino: dtTerminoFormatted, nm_unidade })
                                .then(d => (Array.isArray(d) ? d : [d]))
                                .catch(() => [])
                        )
                    );
                    agendamentos = results.flat();
                } else {
                    const data = await rpcCall('RPCGetAniversarios', { dt_inicio: dtInicioFormatted, dt_termino: dtTerminoFormatted, nm_unidade: '' });
                    agendamentos = Array.isArray(data) ? data : [];
                }
            }
        } else if (schedule.searchMode === 'ultima-consulta') {
            if (schedule.unidades.length > 0) {
                const results = await Promise.all(
                    schedule.unidades.map((nm_unidade: string) =>
                        rpcCall('RPCGetUltimaConsulta', { dt_inicio: dtInicio, dt_termino: dtTermino, nm_unidade })
                            .then(d => (Array.isArray(d) ? d : [d]))
                            .catch(() => [])
                    )
                );
                agendamentos = results.flat();
            } else {
                let targetUnits: string[] = [];
                try {
                    const unitsData = await rpcCall('RPCGetUnidadeAtendimento');
                    if (Array.isArray(unitsData)) {
                        targetUnits = unitsData
                            .map((u: any) => u.TX_UNIDADE_ATENDIMENTO)
                            .filter((name: any) => typeof name === 'string' && name.trim() !== '');
                    }
                } catch (err: any) {
                    console.error('[DisparoCron] Error fetching units fallback for UltimaConsulta:', err.message);
                }

                if (targetUnits.length > 0) {
                    const results = await Promise.all(
                        targetUnits.map((nm_unidade: string) =>
                            rpcCall('RPCGetUltimaConsulta', { dt_inicio: dtInicio, dt_termino: dtTermino, nm_unidade })
                                .then(d => (Array.isArray(d) ? d : [d]))
                                .catch(() => [])
                        )
                    );
                    agendamentos = results.flat();
                } else {
                    const data = await rpcCall('RPCGetUltimaConsulta', { dt_inicio: dtInicio, dt_termino: dtTermino, nm_unidade: '' });
                    agendamentos = Array.isArray(data) ? data : [];
                }
            }
        } else {
            if (schedule.unidades.length > 0) {
                const results = await Promise.all(
                    schedule.unidades.map((nm_unidade: string) =>
                        rpcCall('RPCGetAgendamentos', { dt_inicio: dtInicio, dt_termino: dtTermino, nm_unidade })
                            .then(d => (Array.isArray(d) ? d : [d]))
                            .catch(() => [])
                    )
                );
                agendamentos = results.flat();
            } else {
                const data = await rpcCall('RPCGetAgendamentos', { dt_inicio: dtInicio, dt_termino: dtTermino, nm_unidade: '' });
                agendamentos = Array.isArray(data) ? data : [];
            }
        }

        totalFetched = agendamentos.length;
        console.log(`[DisparoCron] "${schedule.name}" — ${totalFetched} registros buscados da API`);

        // Log unique status values found in data for diagnostics
        const uniqueStatuses = [...new Set(agendamentos.map(ag => extractStatus(ag)).filter(Boolean))];
        if (uniqueStatuses.length > 0) {
            console.log(`[DisparoCron] "${schedule.name}" — status encontrados na API: [${uniqueStatuses.join(', ')}]`);
        }
        if (schedule.statusAgendamento.length > 0) {
            console.log(`[DisparoCron] "${schedule.name}" — filtro de status configurado: [${schedule.statusAgendamento.join(', ')}]`);
        }

        // Deduplicate by phone + appointment key
        const seen = new Set<string>();
        const toSend: any[] = [];
        let filteredNoPhone = 0;
        let filteredDuplicate = 0;
        let filteredAgenda = 0;
        let filteredStatus = 0;
        let filteredPeriodo = 0;
        let filteredMotivo = 0;

        for (const ag of agendamentos) {
            const phone = extractPhone(ag);
            const code = ag.ID_AGENDA_ITEM?.toString() || ag.cd_paciente?.toString() || '';
            
            let dataAg = '';
            let horaAg = '';

            if (schedule.searchMode === 'aniversario') {
                dataAg = ag.DT_ANIV || ag.DT_NASCIMENTO || ag.ANIVERSARIO || ag.DATA || '';
                horaAg = '';
            } else if (schedule.searchMode === 'ultima-consulta') {
                dataAg = ag.ULTIMA_CONSULTA || '';
                horaAg = ag.CONSULTA_AGENDADA || '';
            } else {
                dataAg = ag.DATA || ag.dt_agendamento || ag.data || ag.dt_agenda || '';
                horaAg = ag.INICIO || ag.hr_agendamento || ag.hora || ag.hr_agenda || '';
            }

            const key = `${phone}-${code}-${dataAg}-${horaAg}`;

            if (!phone) { filteredNoPhone++; continue; }
            if (seen.has(key)) { filteredDuplicate++; continue; }
            seen.add(key);

            // Apply filters only for standard "agendamento" mode
            if (!schedule.searchMode || schedule.searchMode === 'agendamento') {
                if (schedule.agendas.length > 0) {
                    const prov = extractProvider(ag);
                    if (prov && !schedule.agendas.includes(prov)) { filteredAgenda++; continue; }
                }
                if (schedule.statusAgendamento.length > 0) {
                    const st = extractStatus(ag);
                    if (st && !statusMatchesFilter(st, schedule.statusAgendamento)) { filteredStatus++; continue; }
                }
                if (schedule.periodos.length > 0) {
                    const slot = getTimeSlot(ag);
                    if (slot && !schedule.periodos.includes(slot)) { filteredPeriodo++; continue; }
                }
                if (schedule.motivo) {
                    const motivo = ag.ds_motivo || ag.motivo || '';
                    if (!motivo.toLowerCase().includes(schedule.motivo.toLowerCase())) { filteredMotivo++; continue; }
                }
            }

            toSend.push(ag);
        }

        totalProcessed = toSend.length;
        console.log(
            `[DisparoCron] "${schedule.name}" — pós-filtro: ${totalProcessed} para enviar` +
            (filteredNoPhone  ? ` | ${filteredNoPhone} sem telefone`  : '') +
            (filteredDuplicate ? ` | ${filteredDuplicate} duplicados`   : '') +
            (filteredAgenda   ? ` | ${filteredAgenda} filtro agenda`   : '') +
            (filteredStatus   ? ` | ${filteredStatus} filtro status`   : '') +
            (filteredPeriodo  ? ` | ${filteredPeriodo} filtro período` : '') +
            (filteredMotivo   ? ` | ${filteredMotivo} filtro motivo`   : '')
        );

        // Send in batches with delay
        for (let i = 0; i < toSend.length; i += schedule.concurrentLimit) {
            const batch = toSend.slice(i, i + schedule.concurrentLimit);

            const results = await Promise.allSettled(
                batch.map(ag => {
                    const fullName = ag.PACIENTE || ag.nm_paciente || ag.paciente || ag.nome || '';
                    const phone = extractPhone(ag);
                    
                    let dataAg = '';
                    let horaAg = '';

                    if (schedule.searchMode === 'aniversario') {
                        dataAg = ag.DT_ANIV || ag.DT_NASCIMENTO || ag.ANIVERSARIO || ag.DATA || '';
                        horaAg = '';
                    } else if (schedule.searchMode === 'ultima-consulta') {
                        dataAg = ag.ULTIMA_CONSULTA || '';
                        horaAg = ag.CONSULTA_AGENDADA || '';
                    } else {
                        dataAg = ag.DATA || ag.dt_agendamento || ag.data || ag.dt_agenda || '';
                        horaAg = ag.INICIO || ag.hr_agendamento || ag.hora || ag.hr_agenda || '';
                    }

                    return sendViaBotConversa({
                        nome: getFirstName(fullName),
                        telefone: phone,
                        unidade: extractUnit(ag),
                        modelo: schedule.modelo,
                        data_agendamento: (schedule.searchMode === 'aniversario' || schedule.searchMode === 'ultima-consulta') ? '' : formatAgendamento(dataAg, horaAg),
                        dentista: extractProvider(ag),
                        motivo: ag.MOTIVO || ag.ds_motivo || ag.motivo || '',
                        status: extractStatus(ag),
                        id_agenda_item: ag.ID_AGENDA_ITEM?.toString() || '',
                        tx_codigo_paciente: ag.TX_CODIGO_PACIENTE?.toString() || ag.cd_paciente?.toString() || '',
                        paciente: fullName,
                        celular: phone,
                        data: schedule.searchMode === 'ultima-consulta' ? (ag.ULTIMA_CONSULTA || '') : dataAg,
                        inicio: schedule.searchMode === 'ultima-consulta' ? '' : horaAg,
                    });
                })
            );

            const batchLogs = batch.map((ag, index) => {
                const r = results[index];
                const fullName = ag.PACIENTE || ag.nm_paciente || ag.paciente || ag.nome || '';
                const phone = extractPhone(ag);
                const unitName = extractUnit(ag) || 'Sem Unidade';
                const success = r.status === 'fulfilled';
                const errMsg = r.status === 'rejected' ? (r.reason?.message || 'Erro de envio') : null;

                return {
                    scheduleLogId: log.id,
                    scheduleId: schedule.id,
                    type: 'automatic',
                    paciente: fullName,
                    telefone: phone,
                    unidade: unitName,
                    modelo: schedule.modelo,
                    status: success ? 'sent' : 'error',
                    errorMessage: errMsg,
                };
            });

            try {
                await prisma.disparoIndividualLog.createMany({ data: batchLogs });
            } catch (dbErr: any) {
                console.error(`[DisparoCron] Erro ao salvar logs individuais no banco:`, dbErr.message);
            }

            for (const r of results) {
                if (r.status === 'fulfilled') totalSent++;
                else { totalErrors++; console.error(`[DisparoCron] Send error:`, r.reason?.message); }
            }

            if (i + schedule.concurrentLimit < toSend.length) {
                await new Promise(resolve => setTimeout(resolve, schedule.delayMs));
            }
        }

        await prisma.scheduledDisparoLog.update({
            where: { id: log.id },
            data: { status: 'completed', totalFetched, totalSent, totalErrors, totalProcessed },
        });

        console.log(`[DisparoCron] "${schedule.name}" concluído — buscados: ${totalFetched}, enviados: ${totalSent}, erros: ${totalErrors}`);
    } catch (error: any) {
        console.error(`[DisparoCron] "${schedule.name}" falhou:`, error.message);
        await prisma.scheduledDisparoLog.update({
            where: { id: log.id },
            data: { status: 'failed', totalFetched, totalSent, totalErrors, totalProcessed, errorMessage: error.message },
        });
    }
}

function registerTask(schedule: ScheduledDisparo): void {
    // Remove existing task if any
    const existing = activeTasks.get(schedule.id);
    if (existing) { existing.stop(); activeTasks.delete(schedule.id); }

    if (!schedule.isActive) return;

    if (!cron.validate(schedule.cronExpression)) {
        console.warn(`[DisparoCron] Invalid cron expression for "${schedule.name}": ${schedule.cronExpression}`);
        return;
    }

    const task = cron.schedule(schedule.cronExpression, () => {
        executeScheduledDisparo(schedule).catch(err =>
            console.error(`[DisparoCron] Unhandled error in "${schedule.name}":`, err)
        );
    }, { timezone: 'America/Sao_Paulo' });

    activeTasks.set(schedule.id, task);
    console.log(`[DisparoCron] Registered "${schedule.name}" — ${schedule.cronExpression}`);
}

export function unregisterTask(scheduleId: string): void {
    const task = activeTasks.get(scheduleId);
    if (task) { task.stop(); activeTasks.delete(scheduleId); }
}

export async function initDisparoCron(): Promise<void> {
    try {
        const schedules = await prisma.scheduledDisparo.findMany({ where: { isActive: true } });
        for (const schedule of schedules) {
            registerTask(schedule);
        }
        console.log(`[DisparoCron] Initialized ${schedules.length} active schedule(s)`);
    } catch (error: any) {
        console.error('[DisparoCron] Failed to initialize:', error.message);
    }
}

// Called by controller after create/update/delete to reload tasks
export async function reloadTask(scheduleId: string): Promise<void> {
    const schedule = await prisma.scheduledDisparo.findUnique({ where: { id: scheduleId } });
    if (!schedule) { unregisterTask(scheduleId); return; }
    registerTask(schedule);
}
