import prisma from '../lib/prisma';
import { fetchFutureAgendamentos, fetchUltimaConsulta, UltimaConsultaRecord } from '../lib/easydental';
import { normalizeCode } from '../lib/patientCode';
import {
    addDays,
    buildEasyDentalSnapshot,
    EasyDentalPatientSnapshot,
    PlannerTreatmentCandidate,
    toIsoDateOnly,
} from '../lib/followUp';

// Janela padrao de busca de ultima consulta: ultimos 12 meses; e agendamentos futuros: proximos 365 dias
const DEFAULT_MONTHS_BACK = 12;
const DEFAULT_FUTURE_DAYS = 365;

export interface SyncOptions {
    tenantId?: string;
    clinicId?: string;
    userId?: string; // restringe aos pacientes de um usuario (sem permissao de gerenciar tudo)
    monthsBack?: number;
    futureDays?: number;
    strict?: boolean;
}

export interface SyncResult {
    fetched: number;      // registros retornados pela API
    candidates: number;   // tratamentos EM_ANDAMENTO avaliados
    matched: number;      // tratamentos com codigo correspondente na API
    updated: number;      // tratamentos efetivamente alterados
    unmatched: number;    // tratamentos sem correspondencia
}

export interface SyncWithSnapshotResult {
    result: SyncResult;
    treatments: PlannerTreatmentCandidate[];
    snapshotByCode: Map<string, EasyDentalPatientSnapshot>;
    todayIso: string;
}

// normalizeCode vive em lib/patientCode.ts; reexportado para quem ja o importa daqui.
export { normalizeCode };

const toISODate = (d: Date) => d.toISOString().slice(0, 10);

const dateOnly = (value?: Date | string | null): string | null => toIsoDateOnly(value);

// Mantido para compatibilidade caso algum modulo importe buildRecordMap.
export const buildRecordMap = (records: UltimaConsultaRecord[]) => {
    const todayIso = toISODate(new Date());
    const snapshot = buildEasyDentalSnapshot(records, [], todayIso);
    const map = new Map<string, { last: string | null; next: string | null }>();
    for (const [code, entry] of snapshot.entries()) {
        map.set(code, { last: entry.lastAppointment, next: entry.nextAppointment });
    }
    return map;
};

const patientSelect = {
    id: true,
    name: true,
    patientNumber: true,
    phone: true,
    clinic: { select: { name: true, nickname: true } },
};

export async function syncTreatmentAppointmentsWithSnapshot(
    options: SyncOptions = {}
): Promise<SyncWithSnapshotResult> {
    const {
        tenantId,
        clinicId,
        userId,
        monthsBack = DEFAULT_MONTHS_BACK,
        futureDays = DEFAULT_FUTURE_DAYS,
        strict = false,
    } = options;

    const now = new Date();
    const todayIso = toISODate(now);
    const dtInicioDate = new Date(now);
    dtInicioDate.setMonth(dtInicioDate.getMonth() - monthsBack);
    const dtInicioIso = toISODate(dtInicioDate);
    const futureEndIso = addDays(todayIso, futureDays);

    let easyDentalComplete = true;
    const [ultimaRecords, futureAgendamentos] = await Promise.all([
        fetchUltimaConsulta(dtInicioIso, todayIso, undefined, { strict }).catch((err) => {
            if (strict) throw err;
            easyDentalComplete = false;
            console.error('Error fetching ultima consulta during sync:', err.message);
            return [];
        }),
        fetchFutureAgendamentos(todayIso, futureEndIso, undefined, { strict }).catch((err) => {
            if (strict) throw err;
            easyDentalComplete = false;
            console.error('Error fetching future agendamentos during sync:', err.message);
            return [];
        }),
    ]);

    const snapshotByCode = buildEasyDentalSnapshot(ultimaRecords, futureAgendamentos, todayIso);

    const patientFilter = {
        ...(tenantId ? { tenantId } : {}),
        ...(clinicId ? { clinicId } : {}),
        ...(userId ? { userId } : {}),
    };

    const rawTreatments = await prisma.treatment.findMany({
        where: {
            status: 'EM_ANDAMENTO',
            OR: [
                { patient: patientFilter },
                { planning: { patient: patientFilter } },
            ],
        },
        select: {
            id: true,
            lastAppointment: true,
            nextAppointment: true,
            patient: { select: patientSelect },
            planning: { select: { patient: { select: patientSelect } } },
        },
    });

    const result: SyncResult = {
        fetched: ultimaRecords.length + futureAgendamentos.length,
        candidates: rawTreatments.length,
        matched: 0,
        updated: 0,
        unmatched: 0,
    };

    const candidates: PlannerTreatmentCandidate[] = [];

    for (const treatment of rawTreatments) {
        // Vinculo SOMENTE pelo "Numero do Paciente" digitado pelo usuario ao criar o paciente.
        const patient = treatment.patient || treatment.planning?.patient;
        if (!patient) continue;

        const code = normalizeCode(patient.patientNumber);
        const match = code ? snapshotByCode.get(code) : undefined;

        let effectiveLast = dateOnly(treatment.lastAppointment);
        let effectiveNext = dateOnly(treatment.nextAppointment);

        if (!code || !match) {
            result.unmatched++;
            // Se o paciente tem codigo valido e a consulta ao EasyDental foi completa sem erro,
            // ausencia de consulta futura no EasyDental limpa nextAppointment obsoleto no Planner.
            if (code && easyDentalComplete && treatment.nextAppointment !== null) {
                await prisma.treatment.update({
                    where: { id: treatment.id },
                    data: { nextAppointment: null },
                });
                effectiveNext = null;
                result.updated++;
            }
        } else {
            result.matched++;
            const data: { lastAppointment?: Date | null; nextAppointment?: Date | null } = {};

            if (match.lastAppointment && match.lastAppointment !== effectiveLast) {
                data.lastAppointment = new Date(`${match.lastAppointment}T00:00:00.000Z`);
                effectiveLast = match.lastAppointment;
            }
            if (match.nextAppointment !== effectiveNext) {
                data.nextAppointment = match.nextAppointment
                    ? new Date(`${match.nextAppointment}T00:00:00.000Z`)
                    : null;
                effectiveNext = match.nextAppointment;
            }

            if (Object.keys(data).length > 0) {
                await prisma.treatment.update({ where: { id: treatment.id }, data });
                result.updated++;
            }
        }

        candidates.push({
            id: treatment.id,
            patientId: patient.id,
            patientName: patient.name,
            patientNumber: patient.patientNumber ?? null,
            patientPhone: patient.phone ?? null,
            clinicName: patient.clinic?.name ?? null,
            clinicNickname: patient.clinic?.nickname ?? null,
            lastAppointment: effectiveLast,
            nextAppointment: effectiveNext,
        });
    }

    return { result, treatments: candidates, snapshotByCode, todayIso };
}

export async function syncTreatmentAppointments(options: SyncOptions = {}): Promise<SyncResult> {
    const { result } = await syncTreatmentAppointmentsWithSnapshot(options);
    return result;
}
