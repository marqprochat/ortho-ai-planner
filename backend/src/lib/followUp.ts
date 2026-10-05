import { normalizeCode } from './patientCode';
import type { UltimaConsultaRecord } from './easydental';

export const FOLLOW_UP_SEARCH_MODE = 'tratamento-sem-reagendamento';

const MAX_CODES = 5000;
const DATES_ERROR = 'dt_inicio e dt_termino são obrigatórios (AAAA-MM-DD)';

const hasScheduledAppointment = (rec: UltimaConsultaRecord): boolean =>
    String(rec.CONSULTA_AGENDADA ?? '').trim() !== '';

// Pacientes em tratamento (treatmentCodes, ja normalizados) sem consulta futura.
// Se o paciente tem consulta agendada em QUALQUER unidade, ele ja reagendou e sai da lista.
export const selectFollowUpRecords = (
    records: UltimaConsultaRecord[],
    treatmentCodes: ReadonlySet<string>
): UltimaConsultaRecord[] => {
    const rescheduled = new Set<string>();
    for (const rec of records) {
        const code = normalizeCode(rec?.CODIGO);
        if (code && hasScheduledAppointment(rec)) rescheduled.add(code);
    }

    const seen = new Set<string>();
    const result: UltimaConsultaRecord[] = [];
    for (const rec of records) {
        const code = normalizeCode(rec?.CODIGO);
        if (!code || !treatmentCodes.has(code) || rescheduled.has(code)) continue;

        const key = `${code}|${rec.UNIDADE ?? ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(rec);
    }
    return result;
};

export interface FollowUpParams {
    dtInicio: string;
    dtTermino: string;
    unidades: string[];
    codigos?: string[];
}

export type FollowUpParamsResult =
    | { ok: true; data: FollowUpParams }
    | { ok: false; error: string };

const isValidIsoDate = (value: string): boolean => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export const parseFollowUpParams = (
    body: unknown,
    options: { requireCodes?: boolean } = {}
): FollowUpParamsResult => {
    const raw = (body ?? {}) as Record<string, unknown>;
    const dtInicio = typeof raw.dt_inicio === 'string' ? raw.dt_inicio.trim() : '';
    const dtTermino = typeof raw.dt_termino === 'string' ? raw.dt_termino.trim() : '';

    if (!isValidIsoDate(dtInicio) || !isValidIsoDate(dtTermino)) return { ok: false, error: DATES_ERROR };
    if (dtInicio > dtTermino) return { ok: false, error: 'dt_inicio não pode ser maior que dt_termino' };

    let unidades: string[] = [];
    if (Array.isArray(raw.unidades)) {
        unidades = raw.unidades
            .filter((u): u is string => typeof u === 'string')
            .map((u) => u.trim())
            .filter(Boolean);
    } else if (typeof raw.unidades === 'string' && raw.unidades.trim() !== '') {
        unidades = [raw.unidades.trim()];
    }

    const data: FollowUpParams = { dtInicio, dtTermino, unidades };

    if (options.requireCodes) {
        if (!Array.isArray(raw.codigos) || !raw.codigos.every((c) => typeof c === 'string')) {
            return { ok: false, error: 'codigos deve ser uma lista de códigos' };
        }
        if (raw.codigos.length > MAX_CODES) {
            return { ok: false, error: `codigos excede o limite de ${MAX_CODES}` };
        }
        data.codigos = (raw.codigos as string[]).map((c) => c.trim());
    }

    return { ok: true, data };
};
