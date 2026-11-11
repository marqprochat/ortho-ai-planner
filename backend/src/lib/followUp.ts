import { normalizeCode } from './patientCode';
import type { AgendamentoRecord, UltimaConsultaRecord } from './easydental';

export const FOLLOW_UP_SEARCH_MODE = 'tratamento-sem-reagendamento';

const MAX_CODES = 5000;

const hasScheduledAppointment = (rec: UltimaConsultaRecord): boolean =>
    String(rec.CONSULTA_AGENDADA ?? '').trim() !== '';

// 'YYYY-MM-DD' + days -> 'YYYY-MM-DD' (aritmetica em UTC, vale entre meses/anos).
export const addDays = (iso: string, days: number): string => {
    const date = new Date(`${iso}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
};

// Janela [dtTermino+1, todayIso] em que uma consulta recente descarta o paciente; null se dtTermino >= todayIso.
export const recentWindow = (
    dtTermino: string,
    todayIso: string
): { dtInicio: string; dtTermino: string } | null => {
    if (dtTermino >= todayIso) return null;
    return { dtInicio: addDays(dtTermino, 1), dtTermino: todayIso };
};

export interface FollowUpSelectOptions {
    dtInicio?: string;
    dtTermino?: string;
    seenAfterCodes?: ReadonlySet<string>;
}

const dateOf = (value: unknown): string => String(value ?? '').slice(0, 10);

// Converte 'YYYY-MM-DD', ISO datetime ou 'DD/MM/YYYY' para 'YYYY-MM-DD' ou null.
export const toIsoDateOnly = (value: unknown): string | null => {
    if (!value) return null;
    if (value instanceof Date) {
        return isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
    }
    const raw = String(value).trim();
    if (!raw) return null;

    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        const iso = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
        return isValidIsoDate(iso) ? iso : null;
    }

    const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (brMatch) {
        const iso = `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
        return isValidIsoDate(iso) ? iso : null;
    }

    return null;
};

const isValidIsoDate = (value: string): boolean => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const normalizeText = (value?: string | null): string =>
    String(value ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ');

const CANCELED_OR_COMPLETED_CODES = new Set(['DCA', 'DPP', 'FAL', 'MDA', 'NAT', 'ATE']);
const CANCELED_OR_COMPLETED_KEYWORDS = [
    'desmarc',
    'faltou',
    'mudar horario',
    'nao atendido',
    'atendido',
    'cancel',
];

// Status que NAO representam uma consulta futura pendente.
export const isCanceledOrCompletedStatus = (status?: string | null): boolean => {
    const raw = String(status ?? '').trim();
    if (!raw) return false;
    if (CANCELED_OR_COMPLETED_CODES.has(raw.toUpperCase())) return true;
    const normalized = normalizeText(raw);
    return CANCELED_OR_COMPLETED_KEYWORDS.some((kw) => normalized.includes(kw));
};

export interface EasyDentalPatientSnapshot {
    lastAppointment: string | null;
    nextAppointment: string | null;
    celular: string | null;
    unidade: string | null;
    paciente: string | null;
}

const firstNonEmpty = (...values: unknown[]): string | null => {
    for (const value of values) {
        const str = String(value ?? '').trim();
        if (str) return str;
    }
    return null;
};

// Consolida por codigo normalizado a ultima consulta, proxima consulta ativa (>= todayIso), celular e unidade.
export const buildEasyDentalSnapshot = (
    ultimaRecords: UltimaConsultaRecord[],
    futureAgendamentos: AgendamentoRecord[],
    todayIso: string
): Map<string, EasyDentalPatientSnapshot> => {
    const map = new Map<string, EasyDentalPatientSnapshot>();

    const getOrCreate = (code: string): EasyDentalPatientSnapshot => {
        let entry = map.get(code);
        if (!entry) {
            entry = {
                lastAppointment: null,
                nextAppointment: null,
                celular: null,
                unidade: null,
                paciente: null,
            };
            map.set(code, entry);
        }
        return entry;
    };

    for (const rec of ultimaRecords) {
        const code = normalizeCode(rec?.CODIGO);
        if (!code) continue;

        const entry = getOrCreate(code);
        const last = toIsoDateOnly(rec.ULTIMA_CONSULTA);
        const next = toIsoDateOnly(rec.CONSULTA_AGENDADA);

        if (last && (!entry.lastAppointment || last > entry.lastAppointment)) {
            entry.lastAppointment = last;
        }
        if (next && next >= todayIso && (!entry.nextAppointment || next < entry.nextAppointment)) {
            entry.nextAppointment = next;
        }
        if (!entry.celular) entry.celular = firstNonEmpty(rec.CELULAR);
        if (!entry.unidade) entry.unidade = firstNonEmpty(rec.UNIDADE);
        if (!entry.paciente) entry.paciente = firstNonEmpty(rec.PACIENTE);
    }

    for (const ag of futureAgendamentos) {
        const code = normalizeCode(
            String(ag?.TX_CODIGO_PACIENTE ?? ag?.cd_paciente ?? ag?.CODIGO ?? '')
        );
        if (!code) continue;

        const status = firstNonEmpty(ag.STATUS, ag.ds_status, ag.status_agendamento, ag.status);
        if (isCanceledOrCompletedStatus(status)) continue;

        const date = toIsoDateOnly(ag.DATA ?? ag.dt_agendamento ?? ag.data ?? ag.dt_agenda);
        if (!date || date < todayIso) continue;

        const entry = getOrCreate(code);
        if (!entry.nextAppointment || date < entry.nextAppointment) {
            entry.nextAppointment = date;
        }
        if (!entry.celular) {
            entry.celular = firstNonEmpty(ag.CELULAR, ag.nr_celular, ag.nr_fone, ag.telefone, ag.celular);
        }
        if (!entry.unidade) {
            entry.unidade = firstNonEmpty(ag.UNIDADE, ag.TX_UNIDADE_ATENDIMENTO, ag.nm_unidade, ag.unidade);
        }
        if (!entry.paciente) {
            entry.paciente = firstNonEmpty(ag.PACIENTE, ag.nm_paciente, ag.paciente, ag.nome);
        }
    }

    return map;
};

const stripUnitPrefix = (normalized: string): string =>
    normalized.replace(/^(unidade|clinica)\s+/, '').trim();

// Verifica se alguma unidade/clinica do paciente casa com o filtro de unidades selecionado.
export const matchesUnitFilter = (
    selectedUnits: readonly string[],
    candidates: ReadonlyArray<string | null | undefined>
): boolean => {
    if (selectedUnits.length === 0) return true;

    const normalizedSelected = new Set(
        selectedUnits.map(normalizeText).filter(Boolean)
    );
    if (normalizedSelected.size === 0) return true;

    for (const candidate of candidates) {
        const norm = normalizeText(candidate);
        if (!norm) continue;
        if (normalizedSelected.has(norm)) return true;

        const stripped = stripUnitPrefix(norm);
        if (stripped && normalizedSelected.has(stripped)) return true;
        for (const sel of normalizedSelected) {
            if (stripUnitPrefix(sel) === stripped) return true;
        }
    }
    return false;
};

export interface PlannerTreatmentCandidate {
    id: string;
    patientId: string;
    patientName: string;
    patientNumber: string | null;
    patientPhone: string | null;
    clinicName: string | null;
    clinicNickname: string | null;
    lastAppointment: string | null;
    nextAppointment: string | null;
}

export interface PatientEasyDentalDetails {
    NOME?: string;
    CELULAR?: string;
}

export interface FollowUpRecord extends UltimaConsultaRecord {
    TREATMENT_ID: string;
    PATIENT_ID: string;
    HAS_PATIENT_CODE: boolean;
}

// Seleciona TODOS os pacientes em tratamento no Planner que nao possuem proxima consulta agendada no EasyDental.
export const selectPlannerFollowUpRecords = (
    treatments: readonly PlannerTreatmentCandidate[],
    easyDentalByCode: ReadonlyMap<string, EasyDentalPatientSnapshot>,
    todayIso: string,
    options: {
        unidades?: readonly string[];
        detailsByCode?: ReadonlyMap<string, PatientEasyDentalDetails>;
    } = {}
): FollowUpRecord[] => {
    const { unidades = [], detailsByCode } = options;
    const seenPatients = new Set<string>();
    const seenCodes = new Set<string>();
    const result: FollowUpRecord[] = [];

    for (const treatment of treatments) {
        if (!treatment.patientId || seenPatients.has(treatment.patientId)) continue;

        const normalizedCode = normalizeCode(treatment.patientNumber);
        if (normalizedCode && seenCodes.has(normalizedCode)) continue;

        const snapshot = normalizedCode ? easyDentalByCode.get(normalizedCode) : undefined;
        const nextDate = normalizedCode
            ? snapshot?.nextAppointment ?? null
            : toIsoDateOnly(treatment.nextAppointment);

        // Se existe proxima consulta agendada (>= hoje), nao entra na listagem.
        if (nextDate && nextDate >= todayIso) continue;

        if (!matchesUnitFilter(unidades, [treatment.clinicName, treatment.clinicNickname, snapshot?.unidade])) {
            continue;
        }

        seenPatients.add(treatment.patientId);
        if (normalizedCode) seenCodes.add(normalizedCode);

        const details = normalizedCode ? detailsByCode?.get(normalizedCode) : undefined;
        const phone = firstNonEmpty(snapshot?.celular, details?.CELULAR, treatment.patientPhone);
        const name = firstNonEmpty(treatment.patientName, snapshot?.paciente, details?.NOME) ?? '';
        const unit = firstNonEmpty(treatment.clinicNickname, treatment.clinicName, snapshot?.unidade) ?? '';
        const lastVisit = snapshot?.lastAppointment ?? toIsoDateOnly(treatment.lastAppointment);

        result.push({
            TREATMENT_ID: treatment.id,
            PATIENT_ID: treatment.patientId,
            HAS_PATIENT_CODE: Boolean(normalizedCode),
            PACIENTE: name,
            CODIGO: normalizedCode ?? '',
            ULTIMA_CONSULTA: lastVisit,
            CELULAR: phone,
            CONSULTA_AGENDADA: null,
            UNIDADE: unit,
        });
    }

    return result.sort((a, b) => a.PACIENTE.localeCompare(b.PACIENTE, 'pt-BR'));
};

// Mantida para compatibilidade com testes unitarios legados.
export const selectFollowUpRecords = (
    records: UltimaConsultaRecord[],
    treatmentCodes: ReadonlySet<string>,
    options: FollowUpSelectOptions = {}
): UltimaConsultaRecord[] => {
    const rescheduled = new Set<string>();
    for (const rec of records) {
        const code = normalizeCode(rec?.CODIGO);
        if (code && hasScheduledAppointment(rec)) rescheduled.add(code);
    }

    const { dtInicio, dtTermino, seenAfterCodes } = options;
    const checkWindow = Boolean(dtInicio && dtTermino);

    const seen = new Set<string>();
    const result: UltimaConsultaRecord[] = [];
    for (const rec of records) {
        const code = normalizeCode(rec?.CODIGO);
        if (!code || !treatmentCodes.has(code) || rescheduled.has(code)) continue;
        if (seenAfterCodes?.has(code)) continue;
        if (checkWindow) {
            const date = dateOf(rec.ULTIMA_CONSULTA);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < (dtInicio as string) || date > (dtTermino as string)) continue;
        }

        const key = `${code}|${rec.UNIDADE ?? ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(rec);
    }
    return result;
};

export interface FollowUpParams {
    unidades: string[];
    codigos?: string[];
    treatmentIds?: string[];
}

export type FollowUpParamsResult =
    | { ok: true; data: FollowUpParams }
    | { ok: false; error: string };

const parseStringArray = (value: unknown): string[] | null => {
    if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) return null;
    if (value.length > MAX_CODES) return null;
    return value.map((v) => v.trim());
};

export const parseFollowUpParams = (
    body: unknown,
    options: { requireCodes?: boolean } = {}
): FollowUpParamsResult => {
    const raw = (body ?? {}) as Record<string, unknown>;

    let unidades: string[] = [];
    if (Array.isArray(raw.unidades)) {
        unidades = raw.unidades
            .filter((u): u is string => typeof u === 'string')
            .map((u) => u.trim())
            .filter(Boolean);
    } else if (typeof raw.unidades === 'string' && raw.unidades.trim() !== '') {
        unidades = [raw.unidades.trim()];
    }

    const data: FollowUpParams = { unidades };

    if (options.requireCodes) {
        const hasCodigos = raw.codigos !== undefined;
        const hasTreatmentIds = raw.treatment_ids !== undefined;

        if (!hasCodigos && !hasTreatmentIds) {
            return { ok: false, error: 'codigos ou treatment_ids deve ser informado' };
        }

        if (hasCodigos) {
            if (!Array.isArray(raw.codigos) || !raw.codigos.every((c) => typeof c === 'string')) {
                return { ok: false, error: 'codigos deve ser uma lista de códigos' };
            }
            if (raw.codigos.length > MAX_CODES) {
                return { ok: false, error: `codigos excede o limite de ${MAX_CODES}` };
            }
            data.codigos = parseStringArray(raw.codigos) ?? [];
        }

        if (hasTreatmentIds) {
            if (!Array.isArray(raw.treatment_ids) || !raw.treatment_ids.every((c) => typeof c === 'string')) {
                return { ok: false, error: 'treatment_ids deve ser uma lista de IDs' };
            }
            if (raw.treatment_ids.length > MAX_CODES) {
                return { ok: false, error: `treatment_ids excede o limite de ${MAX_CODES}` };
            }
            data.treatmentIds = parseStringArray(raw.treatment_ids) ?? [];
        }
    }

    return { ok: true, data };
};
