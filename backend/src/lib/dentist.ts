export interface DentistInput {
    name: string;
    cro: string;
    easyDentalId: string | null;
}

export type DentistInputResult =
    | { ok: true; data: DentistInput }
    | { ok: false; error: string };

const collapse = (value: string) => value.trim().replace(/\s+/g, ' ');

export const normalizeCro = (value: unknown): string =>
    typeof value === 'string' ? collapse(value).toUpperCase() : '';

export const parseDentistInput = (body: unknown): DentistInputResult => {
    const raw = (body ?? {}) as Record<string, unknown>;
    const name = typeof raw.name === 'string' ? collapse(raw.name) : '';
    const cro = normalizeCro(raw.cro);

    if (!name) return { ok: false, error: 'Nome é obrigatório' };
    if (!cro) return { ok: false, error: 'CRO é obrigatório' };

    let easyDentalId: string | null = null;
    if (typeof raw.easyDentalId === 'string') easyDentalId = raw.easyDentalId.trim() || null;
    else if (typeof raw.easyDentalId === 'number') easyDentalId = String(raw.easyDentalId);

    return { ok: true, data: { name, cro, easyDentalId } };
};

export interface ClinicAccessParams {
    clinicId?: string;
    userId?: string;
    tenantId?: string;
    isSuperAdmin?: boolean;
}

/**
 * Builds the Prisma `where` clause to verify that a user has access to the selected clinic.
 * Super admins can access any clinic in their tenant; other users must be linked via UserClinic.
 */
export const buildAccessibleClinicWhere = ({ clinicId, userId, tenantId, isSuperAdmin }: ClinicAccessParams) => {
    if (!clinicId || !userId) return null;
    if (isSuperAdmin) {
        if (!tenantId) return null;
        return { id: clinicId, tenantId };
    }
    return {
        id: clinicId,
        userClinics: { some: { userId } }
    };
};
