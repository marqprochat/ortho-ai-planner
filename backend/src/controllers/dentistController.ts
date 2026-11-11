import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { buildAccessibleClinicWhere, parseDentistInput } from '../lib/dentist';
import { getAuditMetadataFromRequest, logAudit } from '../services/auditService';
import {
    applyDentistStandardization,
    previewDentistStandardization,
} from '../services/dentistStandardization';

const DUPLICATE_CRO_ERROR = 'Já existe um dentista com este CRO nesta clínica';

// A clínica vem do header x-clinic-id; Super Admin acessa clínicas do tenant e demais usuários apenas clínicas vinculadas em UserClinic.
const resolveClinic = async (req: AuthRequest) => {
    const where = buildAccessibleClinicWhere({
        clinicId: req.clinicId,
        userId: req.userId,
        tenantId: req.tenantId,
        isSuperAdmin: Boolean(req.user?.isSuperAdmin),
    });
    if (!where) return null;
    return prisma.clinic.findFirst({ where });
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

export const previewStandardizeDentist = async (req: AuthRequest, res: Response) => {
    try {
        const clinic = await resolveClinic(req);
        if (!clinic) return res.status(400).json({ error: 'Clínica não selecionada ou inválida' });

        const { id } = req.params;
        const preview = await previewDentistStandardization(id, clinic.id);
        if (!preview) return res.status(404).json({ error: 'Dentista não encontrado' });

        res.json(preview);
    } catch (error) {
        console.error('Error previewing dentist standardization:', error);
        res.status(500).json({ error: 'Erro ao buscar registros semelhantes ao dentista' });
    }
};

export const applyStandardizeDentist = async (req: AuthRequest, res: Response) => {
    try {
        const clinic = await resolveClinic(req);
        if (!clinic) return res.status(400).json({ error: 'Clínica não selecionada ou inválida' });

        const { id } = req.params;
        const { treatmentIds, planningIds, contractIds } = req.body ?? {};
        const toStringArray = (val: unknown): string[] =>
            Array.isArray(val) ? val.filter((v): v is string => typeof v === 'string' && v.trim().length > 0) : [];

        const selection = {
            treatmentIds: toStringArray(treatmentIds),
            planningIds: toStringArray(planningIds),
            contractIds: toStringArray(contractIds),
        };

        const result = await applyDentistStandardization(id, clinic.id, selection);
        if (!result) return res.status(404).json({ error: 'Dentista não encontrado' });

        logAudit({
            ...getAuditMetadataFromRequest(req),
            clinicId: clinic.id,
            action: 'UPDATE',
            resource: 'CLINIC',
            resourceId: id,
            details: {
                operation: 'STANDARDIZE_DENTIST',
                dentistName: result.dentist.name,
                dentistCro: result.dentist.cro,
                updated: result.updated,
            },
        });

        res.json(result);
    } catch (error) {
        console.error('Error applying dentist standardization:', error);
        res.status(500).json({ error: 'Erro ao padronizar registros do dentista' });
    }
};
