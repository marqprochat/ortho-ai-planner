import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';

// Get all plannings for a patient
export const getPlannings = async (req: AuthRequest, res: Response) => {
    try {
        const { patientId } = req.params;
        const { tenantId, clinicId } = req;

        // Verify patient belongs to tenant AND current clinic
        const patient = await prisma.patient.findFirst({
            where: {
                id: patientId,
                tenantId,
                clinicId: clinicId // Enforce clinic context
            }
        });

        if (!patient) {
            return res.status(404).json({ error: 'Paciente não encontrado' });
        }

        const plannings = await prisma.planning.findMany({
            where: { patientId },
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
        const { patientId, title, originalReport } = req.body;
        const { tenantId, clinicId } = req; // Proper destructuring from AuthRequest

        // Verify patient belongs to tenant AND current clinic
        const patient = await prisma.patient.findFirst({
            where: {
                id: patientId,
                tenantId,
                clinicId // Enforce clinic context
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
                status: 'DRAFT'
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

        // Verify ownership via patient->tenant AND clinic
        const planning = await prisma.planning.findFirst({
            where: {
                id,
                patient: {
                    tenantId,
                    clinicId // Enforce clinic context
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

        const plannings = await prisma.planning.findMany({
            where: {
                patient: {
                    tenantId,
                    clinicId
                }
            },
            include: {
                patient: {
                    select: {
                        name: true,
                        id: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(plannings);
    } catch (error) {
        console.error('Error fetching all plannings:', error);
        res.status(500).json({ error: 'Erro ao buscar todos os planejamentos' });
    }
};
