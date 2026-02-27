import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, hasPermission } from '../middleware/authMiddleware';

// Get all treatments for tenant/clinic
export const getAllTreatments = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId, clinicId } = req;
        const canManageAll = hasPermission(req.user, 'manage', 'planning');

        const treatments = await prisma.treatment.findMany({
            where: {
                planning: {
                    patient: {
                        tenantId,
                        clinicId,
                        ...(canManageAll ? {} : { userId: req.userId })
                    }
                }
            },
            include: {
                planning: {
                    select: {
                        id: true,
                        title: true,
                        patient: {
                            select: {
                                id: true,
                                name: true,
                                patientNumber: true,
                                user: {
                                    select: {
                                        name: true
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(treatments);
    } catch (error) {
        console.error('Error fetching treatments:', error);
        res.status(500).json({ error: 'Erro ao buscar tratamentos' });
    }
};

// Get treatment for a planning
export const getTreatment = async (req: AuthRequest, res: Response) => {
    try {
        const { planningId } = req.params;
        const { tenantId, clinicId } = req;

        const canManageAll = hasPermission(req.user, 'manage', 'planning');

        // Verify planning belongs to tenant/clinic
        const planning = await prisma.planning.findFirst({
            where: {
                id: planningId,
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

        const treatment = await prisma.treatment.findUnique({
            where: { planningId }
        });

        if (!treatment) {
            return res.status(404).json({ error: 'Tratamento não encontrado' });
        }

        res.json(treatment);
    } catch (error) {
        console.error('Error fetching treatment:', error);
        res.status(500).json({ error: 'Erro ao buscar tratamento' });
    }
};

// Create treatment
export const createTreatment = async (req: AuthRequest, res: Response) => {
    try {
        const { planningId, startDate, deadline, endDate, lastAppointment, nextAppointment, notes, status } = req.body;
        const { tenantId, clinicId } = req;

        const canManageAll = hasPermission(req.user, 'manage', 'planning');

        // Verify planning belongs to tenant/clinic
        const planning = await prisma.planning.findFirst({
            where: {
                id: planningId,
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

        // Check if treatment already exists
        const existing = await prisma.treatment.findUnique({
            where: { planningId }
        });

        if (existing) {
            return res.status(409).json({ error: 'Tratamento já existe para este planejamento' });
        }

        const treatment = await prisma.treatment.create({
            data: {
                planningId,
                startDate: new Date(startDate),
                deadline: deadline ? new Date(deadline) : null,
                endDate: endDate ? new Date(endDate) : null,
                lastAppointment: lastAppointment ? new Date(lastAppointment) : null,
                nextAppointment: nextAppointment ? new Date(nextAppointment) : null,
                notes: notes || null,
                status: status || 'EM_ANDAMENTO'
            }
        });

        res.status(201).json(treatment);
    } catch (error) {
        console.error('Error creating treatment:', error);
        res.status(500).json({ error: 'Erro ao criar tratamento' });
    }
};

// Update treatment
export const updateTreatment = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { startDate, deadline, endDate, lastAppointment, nextAppointment, notes, status } = req.body;
        const { tenantId, clinicId } = req;

        const canManageAll = hasPermission(req.user, 'manage', 'planning');

        // Verify ownership via planning -> patient -> tenant/clinic
        const treatment = await prisma.treatment.findFirst({
            where: {
                id,
                planning: {
                    patient: {
                        tenantId,
                        clinicId,
                        ...(canManageAll ? {} : { userId: req.userId })
                    }
                }
            }
        });

        if (!treatment) {
            return res.status(404).json({ error: 'Tratamento não encontrado' });
        }

        const updated = await prisma.treatment.update({
            where: { id },
            data: {
                ...(startDate !== undefined && { startDate: new Date(startDate) }),
                ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
                ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
                ...(lastAppointment !== undefined && { lastAppointment: lastAppointment ? new Date(lastAppointment) : null }),
                ...(nextAppointment !== undefined && { nextAppointment: nextAppointment ? new Date(nextAppointment) : null }),
                ...(notes !== undefined && { notes }),
                ...(status !== undefined && { status })
            }
        });

        res.json(updated);
    } catch (error) {
        console.error('Error updating treatment:', error);
        res.status(500).json({ error: 'Erro ao atualizar tratamento' });
    }
};

// Delete treatment
export const deleteTreatment = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { tenantId, clinicId } = req;

        const canManageAll = hasPermission(req.user, 'manage', 'planning');

        const treatment = await prisma.treatment.findFirst({
            where: {
                id,
                planning: {
                    patient: {
                        tenantId,
                        clinicId,
                        ...(canManageAll ? {} : { userId: req.userId })
                    }
                }
            }
        });

        if (!treatment) {
            return res.status(404).json({ error: 'Tratamento não encontrado' });
        }

        await prisma.treatment.delete({
            where: { id }
        });

        res.status(204).send();
    } catch (error) {
        console.error('Error deleting treatment:', error);
        res.status(500).json({ error: 'Erro ao excluir tratamento' });
    }
};
