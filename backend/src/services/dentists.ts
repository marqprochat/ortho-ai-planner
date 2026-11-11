import prisma from '../lib/prisma';
import { Dentist } from '@prisma/client';

// clinicId indefinido NUNCA pode virar filtro vazio no Prisma (undefined = sem filtro).
export const findActiveClinicDentist = async (dentistId: string, clinicId: string | undefined): Promise<Dentist | null> => {
    if (!clinicId) return null;
    return prisma.dentist.findFirst({
        where: { id: dentistId, clinicId, isActive: true }
    });
};

export const INVALID_DENTIST_ERROR = 'Dentista inválido para esta clínica';

export type DentistChange =
    | { kind: 'unchanged' }
    | { kind: 'clear' }
    | { kind: 'set'; dentist: Dentist }
    | { kind: 'invalid' };

// Interpreta o dentistId recebido no body:
// undefined -> unchanged; null ou '' -> clear; igual ao atual -> unchanged;
// string diferente -> busca dentista ativo da clínica (set | invalid); qualquer outro tipo -> invalid.
export const resolveDentistChange = async (
    dentistId: unknown,
    currentDentistId: string | null,
    clinicId: string | undefined
): Promise<DentistChange> => {
    if (dentistId === undefined) return { kind: 'unchanged' };
    if (dentistId === null || dentistId === '') return { kind: 'clear' };
    if (typeof dentistId !== 'string') return { kind: 'invalid' };
    if (dentistId === currentDentistId) return { kind: 'unchanged' };
    const dentist = await findActiveClinicDentist(dentistId, clinicId);
    return dentist ? { kind: 'set', dentist } : { kind: 'invalid' };
};
