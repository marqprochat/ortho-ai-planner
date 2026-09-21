import prisma from '../lib/prisma';
import { fetchUltimaConsulta, UltimaConsultaRecord } from '../lib/easydental';

// Janela padrao de busca: pacientes com ultima consulta nos ultimos 6 meses
const DEFAULT_MONTHS_BACK = 6;

export interface SyncOptions {
    tenantId?: string;
    clinicId?: string;
    userId?: string; // restringe aos pacientes de um usuario (sem permissao de gerenciar tudo)
    monthsBack?: number;
}

export interface SyncResult {
    fetched: number;      // registros retornados pela API
    candidates: number;   // tratamentos EM_ANDAMENTO avaliados
    matched: number;      // tratamentos com codigo correspondente na API
    updated: number;      // tratamentos efetivamente alterados
    unmatched: number;    // tratamentos sem correspondencia
}

const toISODate = (d: Date) => d.toISOString().slice(0, 10);

// EasyDental usa codigo com 6 digitos e zeros a esquerda ("000653").
// O Planner pode ter gravado "653", "000653" ou com mascara — normalizamos os dois lados.
export const normalizeCode = (value?: string | null): string | null => {
    if (!value) return null;
    const digits = String(value).replace(/\D/g, '');
    if (!digits) return null;
    return digits.replace(/^0+/, '').padStart(6, '0');
};

const dateOnly = (value?: Date | string | null): string | null => {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
};

// Um mesmo paciente pode aparecer em mais de uma unidade: consolidamos
// a ultima consulta mais recente e a proxima consulta mais proxima.
export const buildRecordMap = (records: UltimaConsultaRecord[]) => {
    const map = new Map<string, { last: string | null; next: string | null }>();

    for (const rec of records) {
        const code = normalizeCode(rec?.CODIGO);
        if (!code) continue;

        const last = dateOnly(rec.ULTIMA_CONSULTA);
        const next = dateOnly(rec.CONSULTA_AGENDADA);
        const current = map.get(code);

        if (!current) {
            map.set(code, { last, next });
            continue;
        }

        if (last && (!current.last || last > current.last)) current.last = last;
        if (next && (!current.next || next < current.next)) current.next = next;
    }

    return map;
};

export async function syncTreatmentAppointments(options: SyncOptions = {}): Promise<SyncResult> {
    const { tenantId, clinicId, userId, monthsBack = DEFAULT_MONTHS_BACK } = options;

    const dtTermino = new Date();
    const dtInicio = new Date();
    dtInicio.setMonth(dtInicio.getMonth() - monthsBack);

    const records = await fetchUltimaConsulta(toISODate(dtInicio), toISODate(dtTermino));
    const byCode = buildRecordMap(records);

    const patientFilter = {
        ...(tenantId ? { tenantId } : {}),
        ...(clinicId ? { clinicId } : {}),
        ...(userId ? { userId } : {}),
    };

    const treatments = await prisma.treatment.findMany({
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
            patient: { select: { patientNumber: true } },
            planning: { select: { patient: { select: { patientNumber: true } } } },
        },
    });

    const result: SyncResult = {
        fetched: records.length,
        candidates: treatments.length,
        matched: 0,
        updated: 0,
        unmatched: 0,
    };

    for (const treatment of treatments) {
        // Vinculo SOMENTE pelo "Numero do Paciente" digitado pelo usuario ao criar o paciente.
        // Nao usamos externalId, id interno, telefone ou nome como fallback.
        const patient = treatment.patient || treatment.planning?.patient;
        const code = normalizeCode(patient?.patientNumber);
        const match = code ? byCode.get(code) : undefined;

        if (!match) {
            result.unmatched++;
            continue;
        }
        result.matched++;

        // EasyDental e a fonte da verdade: sem consulta agendada la, limpamos a proxima consulta.
        const data: { lastAppointment?: Date | null; nextAppointment?: Date | null } = {};
        if (match.last && match.last !== dateOnly(treatment.lastAppointment)) {
            data.lastAppointment = new Date(`${match.last}T00:00:00.000Z`);
        }
        if (match.next !== dateOnly(treatment.nextAppointment)) {
            data.nextAppointment = match.next ? new Date(`${match.next}T00:00:00.000Z`) : null;
        }

        if (Object.keys(data).length === 0) continue;

        await prisma.treatment.update({ where: { id: treatment.id }, data });
        result.updated++;
    }

    return result;
}
