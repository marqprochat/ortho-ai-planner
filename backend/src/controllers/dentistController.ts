import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { parseDentistInput } from '../lib/dentist';

const DUPLICATE_CRO_ERROR = 'Já existe um dentista com este CRO nesta clínica';

// A clínica vem do header x-clinic-id e precisa pertencer ao tenant do usuário.
const resolveClinic = async (req: AuthRequest) => {
    const { clinicId, tenantId } = req;
    if (!clinicId || !tenantId) return null;
    return prisma.clinic.findFirst({ where: { id: clinicId, tenantId } });
};

const isUniqueViolation = (error: unknown) => (error as { code?: string })?.code === 'P2002';

export const listDentists = async (req: AuthRequest, res: Response) => {
    try {
        const clinic = await resolveClinic(req);
        if (!clinic) return res.status(400).json({ error: 'Clínica não selecionada ou inválida' });

        const includeInactive = req.query.includeInactive === 'true';
        const dentists = await prisma.dentist.findMany({
            where: { clinicId: clinic.id, ...(includeInactive ? {} : { isActive: true }) },
            orderBy: { name: 'asc' }
        });
        res.json(dentists);
    } catch (error) {
        console.error('Error listing dentists:', error);
        res.status(500).json({ error: 'Erro ao buscar dentistas' });
    }
};

export const createDentist = async (req: AuthRequest, res: Response) => {
    try {
        const clinic = await resolveClinic(req);
        if (!clinic) return res.status(400).json({ error: 'Clínica não selecionada ou inválida' });

        const parsed = parseDentistInput(req.body);
        if (!parsed.ok) return res.status(400).json({ error: parsed.error });

        const dentist = await prisma.dentist.create({
            data: { ...parsed.data, clinicId: clinic.id }
        });
        res.status(201).json(dentist);
    } catch (error) {
        if (isUniqueViolation(error)) return res.status(409).json({ error: DUPLICATE_CRO_ERROR });
        console.error('Error creating dentist:', error);
        res.status(500).json({ error: 'Erro ao criar dentista' });
    }
};

export const updateDentist = async (req: AuthRequest, res: Response) => {
    try {
        const clinic = await resolveClinic(req);
        if (!clinic) return res.status(400).json({ error: 'Clínica não selecionada ou inválida' });

        const { id } = req.params;
        const existing = await prisma.dentist.findFirst({ where: { id, clinicId: clinic.id } });
        if (!existing) return res.status(404).json({ error: 'Dentista não encontrado' });

        const parsed = parseDentistInput(req.body);
        if (!parsed.ok) return res.status(400).json({ error: parsed.error });

        const isActive = typeof req.body?.isActive === 'boolean' ? req.body.isActive : existing.isActive;
        const updated = await prisma.dentist.update({
            where: { id },
            data: { ...parsed.data, isActive }
        });
        res.json(updated);
    } catch (error) {
        if (isUniqueViolation(error)) return res.status(409).json({ error: DUPLICATE_CRO_ERROR });
        console.error('Error updating dentist:', error);
        res.status(500).json({ error: 'Erro ao atualizar dentista' });
    }
};

export const deleteDentist = async (req: AuthRequest, res: Response) => {
    try {
        const clinic = await resolveClinic(req);
        if (!clinic) return res.status(400).json({ error: 'Clínica não selecionada ou inválida' });

        const { id } = req.params;
        const existing = await prisma.dentist.findFirst({
            where: { id, clinicId: clinic.id },
            include: { _count: { select: { plannings: true, treatments: true } } }
        });
        if (!existing) return res.status(404).json({ error: 'Dentista não encontrado' });

        if (existing._count.plannings + existing._count.treatments > 0) {
            await prisma.dentist.update({ where: { id }, data: { isActive: false } });
            return res.json({ deactivated: true });
        }

        await prisma.dentist.delete({ where: { id } });
        res.json({ deleted: true });
    } catch (error) {
        console.error('Error deleting dentist:', error);
        res.status(500).json({ error: 'Erro ao excluir dentista' });
    }
};
