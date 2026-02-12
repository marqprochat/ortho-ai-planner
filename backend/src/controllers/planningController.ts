import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, hasPermission } from '../middleware/authMiddleware';

// Get all plannings for a patient
export const getPlannings = async (req: AuthRequest, res: Response) => {
    try {
        const { patientId } = req.params;
        const { tenantId, clinicId } = req;

        const canManageAll = hasPermission(req.user, 'manage', 'planning');

        // Verify patient belongs to tenant AND current clinic (and user if not manager)
        const patient = await prisma.patient.findFirst({
            where: {
                id: patientId,
                tenantId,
                clinicId: clinicId,
                ...(canManageAll ? {} : { userId: req.userId })
            }
        });

        if (!patient) {
            return res.status(404).json({ error: 'Paciente não encontrado' });
        }

        const plannings = await prisma.planning.findMany({
            where: { patientId },
            include: { contracts: true, treatment: true },
            orderBy: { createdAt: 'desc' }
        });

        res.json(plannings);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar planejamentos' });
    }
};

// Create a new planning
export const createPlanning = async (req: AuthRequest, res: Response) => {
    try {
        const { patientId, title, originalReport, status, structuredPlan } = req.body;
        const { tenantId, clinicId } = req; // Proper destructuring from AuthRequest

        const canManageAll = hasPermission(req.user, 'manage', 'planning');

        // Verify patient belongs to tenant AND current clinic (and user if not manager)
        const patient = await prisma.patient.findFirst({
            where: {
                id: patientId,
                tenantId,
                clinicId,
                ...(canManageAll ? {} : { userId: req.userId })
            }
        });

        if (!patient) {
            return res.status(404).json({ error: 'Paciente não encontrado' });
        }

        const planning = await prisma.planning.create({
            data: {
                title,
                originalReport,
                patientId,
                status: status || 'DRAFT',
                structuredPlan
            }
        });

        res.status(201).json(planning);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao criar planejamento' });
    }
};

// Update planning (e.g. save AI response)
export const updatePlanning = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { status, aiResponse, structuredPlan } = req.body;
        const { tenantId, clinicId } = req;

        const canManageAll = hasPermission(req.user, 'manage', 'planning');

        // Verify ownership via patient->tenant AND clinic (and user if not manager)
        const planning = await prisma.planning.findFirst({
            where: {
                id,
                patient: {
                    tenantId,
                    clinicId,
                    ...(canManageAll ? {} : { userId: req.userId })
                }
            }
        });

        if (!planning) {
            return res.status(404).json({ error: 'Planejamento não encontrado' });
        }

        const updated = await prisma.planning.update({
            where: { id },
            data: {
                status,
                aiResponse,
                structuredPlan
            }
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar planejamento' });
    }
};

// Get all plannings for tenant/clinic
export const getAllPlannings = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId, clinicId } = req;

        const canManageAll = hasPermission(req.user, 'manage', 'planning');

        const plannings = await prisma.planning.findMany({
            where: {
                patient: {
                    tenantId,
                    clinicId,
                    ...(canManageAll ? {} : { userId: req.userId })
                }
            },
            include: {
                patient: {
                    select: {
                        name: true,
                        id: true
                    }
                },
                contracts: true,
                treatment: true
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(plannings);
    } catch (error) {
        console.error('Error fetching all plannings:', error);
        res.status(500).json({ error: 'Erro ao buscar todos os planejamentos' });
    }
};

// Delete a planning
export const deletePlanning = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { tenantId, userId, clinicId } = req;

        const canManageAll = hasPermission(req.user, 'manage', 'planning');

        // Verify patient ownership (via patient) and clinic context
        const planning = await prisma.planning.findFirst({
            where: {
                id,
                patient: {
                    tenantId,
                    clinicId,
                    ...(canManageAll ? {} : { userId })
                }
            }
        });

        if (!planning) {
            return res.status(404).json({ error: 'Planejamento não encontrado' });
        }

        await prisma.planning.delete({
            where: { id }
        });

        res.status(204).send();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao excluir planejamento' });
    }
};
