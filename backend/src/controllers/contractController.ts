import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Create a new contract
export const createContract = async (req: Request, res: Response) => {
    try {
        const { patientId, content, logoUrl } = req.body;
        const { tenantId } = req as any;

        // Verify patient belongs to tenant
        const patient = await prisma.patient.findFirst({
            where: { id: patientId, tenantId }
        });

        if (!patient) {
            return res.status(404).json({ error: 'Paciente não encontrado' });
        }

        const contract = await prisma.contract.create({
            data: {
                patientId,
                content,
                logoUrl: logoUrl || null
            }
        });

        res.status(201).json(contract);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao criar contrato' });
    }
};

// Get contracts for a patient
export const getPatientContracts = async (req: Request, res: Response) => {
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
export const getContract = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { tenantId } = req as any;

        const contract = await prisma.contract.findFirst({
            where: {
                id,
                patient: { tenantId }
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
export const getAllContracts = async (req: Request, res: Response) => {
    try {
        const { tenantId, clinicId } = req as any;

        const contracts = await prisma.contract.findMany({
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

        res.json(contracts);
    } catch (error) {
        console.error('Error fetching all contracts:', error);
        res.status(500).json({ error: 'Erro ao buscar todos os contratos' });
    }
};
