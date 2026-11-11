import prisma from '../lib/prisma';
import { getPacienteByCod } from '../lib/easydental';
import { normalizeCode } from '../lib/patientCode';
import {
    FollowUpRecord,
    PatientEasyDentalDetails,
    selectPlannerFollowUpRecords,
} from '../lib/followUp';
import { syncTreatmentAppointmentsWithSnapshot } from './appointmentSync';

export interface FollowUpQuery {
    tenantId: string;
    unidades?: string[];
}

const DETAILS_CONCURRENCY = 5;

async function fetchPatientDetailsBatch(
    codes: string[]
): Promise<Map<string, PatientEasyDentalDetails>> {
    const detailsByCode = new Map<string, PatientEasyDentalDetails>();
    for (let i = 0; i < codes.length; i += DETAILS_CONCURRENCY) {
        const batch = codes.slice(i, i + DETAILS_CONCURRENCY);
        const results = await Promise.all(
            batch.map(async (code) => {
                try {
                    const details = await getPacienteByCod(code);
                    return { code, details };
                } catch (err: any) {
                    console.error(`Error fetching EasyDental details for code ${code}:`, err.message);
                    return { code, details: null };
                }
            })
        );
        for (const { code, details } of results) {
            if (details) detailsByCode.set(code, details);
        }
    }
    return detailsByCode;
}

// Sincroniza tratamentos EM_ANDAMENTO do Planner com o EasyDental ao vivo (modo estrito)
// e retorna todos os pacientes em tratamento sem proxima consulta agendada.
export const findTreatmentsWithoutReschedule = async (
    query: FollowUpQuery
): Promise<FollowUpRecord[]> => {
    // Um tenantId indefinido viraria "sem filtro" no Prisma: nunca prosseguir sem ele.
    if (!query.tenantId) throw new Error('tenantId é obrigatório');

    const { treatments, snapshotByCode, todayIso } = await syncTreatmentAppointmentsWithSnapshot({
        tenantId: query.tenantId,
        strict: true,
    });

    const initial = selectPlannerFollowUpRecords(treatments, snapshotByCode, todayIso, {
        unidades: query.unidades,
    });

    const codesNeedingDetails = initial
        .filter((rec) => rec.HAS_PATIENT_CODE && !snapshotByCode.get(rec.CODIGO)?.celular)
        .map((rec) => rec.CODIGO);

    if (codesNeedingDetails.length === 0) return initial;

    const detailsByCode = await fetchPatientDetailsBatch(codesNeedingDetails);
    return selectPlannerFollowUpRecords(treatments, snapshotByCode, todayIso, {
        unidades: query.unidades,
        detailsByCode,
    });
};

export interface RevalidateFollowUpResult {
    eligible: string[];
    eligibleTreatmentIds: string[];
}

// Refaz a sincronizacao/busca ao vivo e devolve os codigos e treatmentIds que continuam elegiveis.
export const revalidateFollowUp = async (
    query: FollowUpQuery & { codigos?: string[]; treatmentIds?: string[] }
): Promise<RevalidateFollowUpResult> => {
    const eligibleRecords = await findTreatmentsWithoutReschedule({
        tenantId: query.tenantId,
        unidades: query.unidades,
    });

    const eligibleCodeSet = new Set(
        eligibleRecords
            .map((rec) => normalizeCode(rec.CODIGO))
            .filter((c): c is string => c !== null)
    );
    const eligibleTreatmentSet = new Set(eligibleRecords.map((rec) => rec.TREATMENT_ID));

    const eligible = (query.codigos ?? []).filter((codigo) => {
        const normalized = normalizeCode(codigo);
        return normalized !== null && eligibleCodeSet.has(normalized);
    });

    const eligibleTreatmentIds = (query.treatmentIds ?? []).filter((id) =>
        eligibleTreatmentSet.has(id)
    );

    return { eligible, eligibleTreatmentIds };
};

// Tenant do usuario que criou um agendamento (cron nao tem usuario logado).
export const resolveTenantByUserId = async (userId: string): Promise<string | null> => {
    if (!userId || userId === 'system') return null;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { tenantId: true } });
    return user?.tenantId ?? null;
};
