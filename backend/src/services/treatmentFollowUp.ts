import prisma from '../lib/prisma';
import { fetchUltimaConsulta, UltimaConsultaRecord } from '../lib/easydental';
import { normalizeCode } from '../lib/patientCode';
import { selectFollowUpRecords } from '../lib/followUp';

export interface FollowUpQuery {
    tenantId: string;
    dtInicio: string;
    dtTermino: string;
    unidades?: string[];
}

// Codigos (normalizados) dos pacientes com tratamento EM_ANDAMENTO no tenant.
// Vinculo SOMENTE pelo "Numero do Paciente" (patientNumber), como no appointmentSync.
const loadTreatmentCodes = async (tenantId: string): Promise<Set<string>> => {
    const treatments = await prisma.treatment.findMany({
        where: {
            status: 'EM_ANDAMENTO',
            OR: [
                { patient: { tenantId } },
                { planning: { patient: { tenantId } } },
            ],
        },
        select: {
            patient: { select: { patientNumber: true } },
            planning: { select: { patient: { select: { patientNumber: true } } } },
        },
    });

    const codes = new Set<string>();
    for (const treatment of treatments) {
        const patient = treatment.patient || treatment.planning?.patient;
        const code = normalizeCode(patient?.patientNumber);
        if (code) codes.add(code);
    }
    return codes;
};

// EasyDental ao vivo (modo estrito: erro de unidade nao vira lista vazia) x tratamentos do Planner.
export const findTreatmentsWithoutReschedule = async (query: FollowUpQuery): Promise<UltimaConsultaRecord[]> => {
    // Um tenantId indefinido viraria "sem filtro" no Prisma: nunca prosseguir sem ele.
    if (!query.tenantId) throw new Error('tenantId é obrigatório');

    const [records, treatmentCodes] = await Promise.all([
        fetchUltimaConsulta(query.dtInicio, query.dtTermino, query.unidades, { strict: true }),
        loadTreatmentCodes(query.tenantId),
    ]);
    return selectFollowUpRecords(records, treatmentCodes);
};

// Refaz a busca ao vivo e devolve, dos `codigos` recebidos, os que continuam elegiveis.
export const revalidateFollowUp = async (query: FollowUpQuery & { codigos: string[] }): Promise<string[]> => {
    const eligible = await findTreatmentsWithoutReschedule(query);
    const eligibleCodes = new Set(eligible.map((rec) => normalizeCode(rec.CODIGO)));
    return query.codigos.filter((codigo) => {
        const normalized = normalizeCode(codigo);
        return normalized !== null && eligibleCodes.has(normalized);
    });
};

// Tenant do usuario que criou um agendamento (cron nao tem usuario logado).
export const resolveTenantByUserId = async (userId: string): Promise<string | null> => {
    if (!userId || userId === 'system') return null;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { tenantId: true } });
    return user?.tenantId ?? null;
};
