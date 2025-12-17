import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get all plannings for a patient
export const getPlannings = async (req: Request, res: Response) => {
    try {
        const { patientId } = req.params;
        const { tenantId } = req as any;

        // Verify patient belongs to tenant
        const patient = await prisma.patient.findFirst({
            where: { id: patientId, tenantId }
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
export const createPlanning = async (req: Request, res: Response) => {
    try {
        const { patientId, title, originalReport } = req.body;
        const { tenantId } = req as any;

        // Verify patient belongs to tenant
        const patient = await prisma.patient.findFirst({
            where: { id: patientId, tenantId }
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
export const updatePlanning = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, aiResponse, structuredPlan } = req.body;
        const { tenantId } = req as any;

        // Verify ownership via patient->tenant
        const planning = await prisma.planning.findFirst({
            where: {
                id,
                patient: { tenantId }
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
