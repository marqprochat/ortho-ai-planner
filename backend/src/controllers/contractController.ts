import { Response } from 'express';
import { AuthRequest, hasPermission } from '../middleware/authMiddleware';
import prisma from '../lib/prisma';

// Create a new contract
export const createContract = async (req: AuthRequest, res: Response) => {
    try {
        const { patientId, content, logoUrl, planningId } = req.body;
        const { tenantId, userId, clinicId } = req;

        const canManageAll = hasPermission(req.user, 'manage', 'patient');

        // Verify patient belongs to tenant and user (unless admin)
        const patient = await prisma.patient.findFirst({
            where: {
                id: patientId,
                tenantId,
                clinicId,
                ...(canManageAll ? {} : { userId })
            }
        });

        if (!patient) {
            return res.status(404).json({ error: 'Paciente não encontrado' });
        }

        const contract = await prisma.contract.create({
            data: {
                patientId,
                content,
                logoUrl: logoUrl || null,
                planningId: planningId || null
            }
        });

        res.status(201).json(contract);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao criar contrato' });
    }
};

// Get contracts for a patient
export const getPatientContracts = async (req: AuthRequest, res: Response) => {
    try {
        const { patientId } = req.params;
        const { tenantId, userId, clinicId } = req;

        const canManageAll = hasPermission(req.user, 'manage', 'patient');

        // Verify patient belongs to tenant and user (unless admin)
        const patient = await prisma.patient.findFirst({
            where: {
                id: patientId,
                tenantId,
                clinicId,
                ...(canManageAll ? {} : { userId })
            }
        });

        if (!patient) {
            return res.status(404).json({ error: 'Paciente não encontrado' });
        }

        const contracts = await prisma.contract.findMany({
            where: { patientId },
            orderBy: { createdAt: 'desc' }
        });

        res.json(contracts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar contratos' });
    }
};

// Get a single contract
export const getContract = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { tenantId, userId, clinicId } = req;

        const canManageAll = hasPermission(req.user, 'manage', 'patient');

        const contract = await prisma.contract.findFirst({
            where: {
                id,
                patient: {
                    tenantId,
                    clinicId,
                    ...(canManageAll ? {} : { userId })
                }
            },
            include: {
                patient: true
            }
        });

        if (!contract) {
            return res.status(404).json({ error: 'Contrato não encontrado' });
        }

        res.json(contract);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar contrato' });
    }
};

// Get all contracts for tenant/clinic
export const getAllContracts = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId, clinicId, userId } = req;

        const canManageAll = hasPermission(req.user, 'manage', 'patient');

        const contracts = await prisma.contract.findMany({
            where: {
                patient: {
                    tenantId,
                    clinicId,
                    ...(canManageAll ? {} : { userId })
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

        res.json(contracts);
    } catch (error) {
        console.error('Error fetching all contracts:', error);
        res.status(500).json({ error: 'Erro ao buscar todos os contratos' });
    }
};

// Delete a contract
export const deleteContract = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { tenantId, userId, clinicId } = req;

        const canManageAll = hasPermission(req.user, 'manage', 'patient'); // Using manage patient as fallback

        const contract = await prisma.contract.findFirst({
            where: {
                id,
                patient: {
                    tenantId,
                    clinicId,
                    ...(canManageAll ? {} : { userId })
                }
            }
        });

        if (!contract) {
            return res.status(404).json({ error: 'Contrato não encontrado' });
        }

        await prisma.contract.delete({
            where: { id }
        });

        res.status(204).send();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao excluir contrato' });
    }
};

// Sign a contract
export const signContract = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { tenantId, userId, clinicId } = req;

        const canManageAll = hasPermission(req.user, 'manage', 'patient');

        const contract = await prisma.contract.findFirst({
            where: {
                id,
                patient: {
                    tenantId,
                    clinicId,
                    ...(canManageAll ? {} : { userId })
                }
            }
        });

        if (!contract) {
            return res.status(404).json({ error: 'Contrato não encontrado' });
        }

        const updatedContract = await prisma.contract.update({
            where: { id },
            data: {
                isSigned: true,
                signedAt: new Date()
            }
        });

        res.json(updatedContract);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao assinar contrato' });
    }
};
