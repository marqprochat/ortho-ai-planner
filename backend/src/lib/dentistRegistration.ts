// Regras do cadastro de dentista a partir do CPF do prestador no EasyDental.
// Funções puras: recebem os dados já carregados e devolvem o plano por unidade.

export type RegistrationStatus = 'will_register' | 'already_registered' | 'no_access' | 'no_clinic';

export interface RegistrationClinic {
    id: string;
    name: string;
    nickname?: string | null;
    easyDentalUnitName?: string | null;
}

export interface ExistingDentistRef {
    id: string;
    clinicId: string;
    name: string;
    cro: string;
    cpf: string | null;
    easyDentalId: string | null;
    isActive: boolean;
}

export interface RegistrationRow {
    unitName: string | null;
    clinicId: string | null;
    clinicName: string | null;
    status: RegistrationStatus;
    // 'unit': unidade indicada pelo EasyDental; 'current_clinic': clínica selecionada usada como alternativa
    source: 'unit' | 'current_clinic';
    existingDentist?: { id: string; name: string; cro: string; isActive: boolean };
}

export interface PlanInput {
    units: string[];
    clinics: RegistrationClinic[];
    accessibleClinicIds: Set<string>;
    existing: ExistingDentistRef[];
    cpf: string;
    easyDentalId: string | null;
    prestadorName: string;
    // Clínica selecionada: usada quando o EasyDental não indica nenhuma unidade com clínica vinculada.
    currentClinicId?: string | null;
}

export const onlyDigits = (value: unknown): string =>
    typeof value === 'string' || typeof value === 'number' ? String(value).replace(/\D/g, '') : '';

export const isValidCpf = (value: unknown): boolean => {
    const cpf = onlyDigits(value);
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    const digit = (len: number) => {
        let sum = 0;
        for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
        const rest = (sum * 10) % 11;
        return rest === 10 ? 0 : rest;
    };
    return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
};

export const formatCpfDigits = (value: unknown): string => {
    const cpf = onlyDigits(value);
    if (cpf.length !== 11) return cpf;
    return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
};

// Compara nomes de unidade/pessoa ignorando acentos, caixa e espaços extras.
export const normalizeName = (value: unknown): string =>
    typeof value === 'string'
        ? value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/\s+/g, ' ').toLowerCase()
        : '';

// Linha do RPCGetPrestadorCPF: a API devolve { id_prestador, nm_prestador }; aceita também maiúsculas.
export const normalizePrestador = (row: unknown): { ID_PRESTADOR?: string | number; NOME?: string } | null => {
    if (!row || typeof row !== 'object') return null;
    const r = row as Record<string, unknown>;
    const pick = (...keys: string[]) => keys.map((k) => r[k]).find((v) => v !== undefined && v !== null && v !== '');
    const id = pick('ID_PRESTADOR', 'id_prestador');
    const name = pick('NOME', 'nm_prestador', 'NM_PRESTADOR', 'nome');
    if (id === undefined && name === undefined) return null;
    return {
        ID_PRESTADOR: typeof id === 'number' || typeof id === 'string' ? id : undefined,
        NOME: typeof name === 'string' ? name : undefined,
    };
};

export const clinicLabel =(clinic: RegistrationClinic): string => clinic.nickname?.trim() || clinic.name;

// O dentista já existe na clínica se bater CPF, ID do EasyDental ou o nome padronizado.
export const findExistingInClinic = (
    clinicId: string,
    existing: ExistingDentistRef[],
    match: { cpf: string; easyDentalId: string | null; prestadorName: string }
): ExistingDentistRef | undefined => {
    const cpf = onlyDigits(match.cpf);
    const name = normalizeName(match.prestadorName);
    const inClinic = existing.filter((d) => d.clinicId === clinicId);
    return (
        inClinic.find((d) => cpf && onlyDigits(d.cpf) === cpf) ||
        inClinic.find((d) => match.easyDentalId && d.easyDentalId === match.easyDentalId) ||
        inClinic.find((d) => name && normalizeName(d.name) === name)
    );
};

const rowForClinic = (
    unitName: string | null,
    clinic: RegistrationClinic,
    input: PlanInput,
    source: RegistrationRow['source']
): RegistrationRow => {
    const found = findExistingInClinic(clinic.id, input.existing, input);
    const base = { unitName, clinicId: clinic.id, clinicName: clinicLabel(clinic), source };
    if (found) {
        return {
            ...base,
            status: 'already_registered',
            existingDentist: { id: found.id, name: found.name, cro: found.cro, isActive: found.isActive },
        };
    }
    return { ...base, status: input.accessibleClinicIds.has(clinic.id) ? 'will_register' : 'no_access' };
};

export const buildRegistrationPlan = (input: PlanInput): RegistrationRow[] => {
    const rows: RegistrationRow[] = [];
    const seenUnits = new Set<string>();
    const seenClinics = new Set<string>();

    for (const unit of input.units) {
        const key = normalizeName(unit);
        if (!key || seenUnits.has(key)) continue;
        seenUnits.add(key);

        const unitName = unit.trim();
        const clinics = input.clinics.filter((c) => normalizeName(c.easyDentalUnitName) === key);
        if (clinics.length === 0) {
            rows.push({ unitName, clinicId: null, clinicName: null, status: 'no_clinic', source: 'unit' });
            continue;
        }
        for (const clinic of clinics) {
            if (seenClinics.has(clinic.id)) continue;
            seenClinics.add(clinic.id);
            rows.push(rowForClinic(unitName, clinic, input, 'unit'));
        }
    }

    // Sem nenhuma unidade com clínica vinculada: oferece a clínica selecionada.
    const hasClinicRow = rows.some((r) => r.clinicId);
    if (!hasClinicRow && input.currentClinicId) {
        const current = input.clinics.find((c) => c.id === input.currentClinicId);
        if (current) rows.push(rowForClinic(current.easyDentalUnitName?.trim() || null, current, input, 'current_clinic'));
    }

    return rows;
};

export interface PlanSummary {
    toRegister: RegistrationRow[];
    alreadyRegistered: RegistrationRow[];
    noAccess: RegistrationRow[];
    noClinic: RegistrationRow[];
    // true quando o usuário tem acesso a todas as unidades em que falta o cadastro
    canRegisterAll: boolean;
}

export const summarizePlan = (rows: RegistrationRow[]): PlanSummary => {
    const by = (status: RegistrationStatus) => rows.filter((r) => r.status === status);
    const noAccess = by('no_access');
    return {
        toRegister: by('will_register'),
        alreadyRegistered: by('already_registered'),
        noAccess,
        noClinic: by('no_clinic'),
        canRegisterAll: noAccess.length === 0,
    };
};

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// O RPC de produção do EasyDental aceita no máximo 35 dias por consulta.
export const buildDateWindows = (end: Date, totalDays: number, maxSpanDays = 30) => {
    const windows: { dt_inicio: string; dt_termino: string }[] = [];
    let cursor = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    let remaining = totalDays;
    while (remaining > 0) {
        const span = Math.min(maxSpanDays, remaining);
        const start = new Date(cursor);
        start.setDate(start.getDate() - (span - 1));
        windows.push({ dt_inicio: isoDate(start), dt_termino: isoDate(cursor) });
        cursor = new Date(start);
        cursor.setDate(cursor.getDate() - 1);
        remaining -= span;
    }
    return windows;
};

// Extrai as unidades das linhas do KPI de produção que pertencem ao prestador.
export const extractUnitsFromKpi = (rows: unknown, prestadorName: string): string[] => {
    if (!Array.isArray(rows)) return [];
    const target = normalizeName(prestadorName);
    const units = new Map<string, string>();
    for (const row of rows as Record<string, unknown>[]) {
        if (normalizeName(row?.TX_PRESTADOR) !== target) continue;
        const unit = typeof row?.TX_UNIDADE_ATENDIMENTO === 'string' ? row.TX_UNIDADE_ATENDIMENTO.trim() : '';
        if (unit && !units.has(normalizeName(unit))) units.set(normalizeName(unit), unit);
    }
    return [...units.values()];
};
