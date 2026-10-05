import prisma from '../lib/prisma';
import { Dentist } from '@prisma/client';

// clinicId indefinido NUNCA pode virar filtro vazio no Prisma (undefined = sem filtro).
export const findActiveClinicDentist = async (dentistId: string, clinicId: string | undefined): Promise<Dentist | null> => {
    if (!clinicId) return null;
    return prisma.dentist.findFirst({
        where: { id: dentistId, clinicId, isActive: true }
    });
};
