import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';

/**
 * Report for all patients with detailed info and filters
 */
export const getPatientsReport = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId, clinicId } = req;
        const query = req.query as any;
        const search = query.search;
        const startDate = query.startDate;
        const endDate = query.endDate;

        if (!clinicId) {
            return res.status(400).json({ error: 'Clínica não selecionada' });
        }

        const patients = await prisma.patient.findMany({
            where: {
                tenantId,
                clinicId,
                AND: [
                    search ? {
                        OR: [
                            { name: { contains: String(search), mode: 'insensitive' } },
                            { patientNumber: { contains: String(search), mode: 'insensitive' } },
                            { email: { contains: String(search), mode: 'insensitive' } }
                        ]
                    } : {},
                    startDate ? { createdAt: { gte: new Date(String(startDate)) } } : {},
                    endDate ? { createdAt: { lte: new Date(String(endDate)) } } : {}
                ]
            },
            include: {
                user: { select: { name: true } },
                _count: { select: { plannings: true, contracts: true, treatments: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(patients);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao gerar relatório de pacientes' });
    }
};

/**
 * Report for plannings (can filter by status like DRAFT)
 */
export const getPlanningsReport = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId, clinicId } = req;
        const query = req.query as any;
        const status = query.status;
        const search = query.search;
        const startDate = query.startDate;
        const endDate = query.endDate;

        if (!clinicId) {
            return res.status(400).json({ error: 'Clínica não selecionada' });
        }

        const plannings = await prisma.planning.findMany({
            where: {
                patient: {
                    tenantId,
                    clinicId
                },
                AND: [
                    status ? { status: String(status) } : {},
                    search ? {
                        OR: [
                            { title: { contains: String(search), mode: 'insensitive' } },
                            { patient: { name: { contains: String(search), mode: 'insensitive' } } }
                        ]
                    } : {},
                    startDate ? { createdAt: { gte: new Date(String(startDate)) } } : {},
                    endDate ? { createdAt: { lte: new Date(String(endDate)) } } : {}
                ]
            },
            include: {
                patient: { select: { name: true, patientNumber: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(plannings);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao gerar relatório de planejamentos' });
    }
};

/**
 * Report for contracts (signed/unsigned)
 */
export const getContractsReport = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId, clinicId } = req;
        const query = req.query as any;
        const isSigned = query.isSigned;
        const search = query.search;
        const startDate = query.startDate;
        const endDate = query.endDate;

        if (!clinicId) {
            return res.status(400).json({ error: 'Clínica não selecionada' });
        }

        const contracts = await prisma.contract.findMany({
            where: {
                patient: {
                    tenantId,
                    clinicId
                },
                AND: [
                    isSigned !== undefined ? { isSigned: isSigned === 'true' } : {},
                    search ? {
                        patient: { name: { contains: String(search), mode: 'insensitive' } }
                    } : {},
                    startDate ? { createdAt: { gte: new Date(String(startDate)) } } : {},
                    endDate ? { createdAt: { lte: new Date(String(endDate)) } } : {}
                ]
            },
            include: {
                patient: { select: { name: true, patientNumber: true } },
                planning: { select: { title: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(contracts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao gerar relatório de contratos' });
    }
};

/**
 * Report for treatments (active, pending, new)
 */
export const getTreatmentsReport = async (req: AuthRequest, res: Response) => {
    try {
        const { tenantId, clinicId } = req;
        const query = req.query as any;
        const status = query.status;
        const search = query.search;
        const startDate = query.startDate;
        const endDate = query.endDate;

        if (!clinicId) {
            return res.status(400).json({ error: 'Clínica não selecionada' });
        }

        const treatments = await prisma.treatment.findMany({
            where: {
                patient: {
                    tenantId,
                    clinicId
                },
                AND: [
                    status ? { status: String(status) } : {},
                    search ? {
                        OR: [
                            { patient: { name: { contains: String(search), mode: 'insensitive' } } },
                            { notes: { contains: String(search), mode: 'insensitive' } }
                        ]
                    } : {},
                    startDate ? { createdAt: { gte: new Date(String(startDate)) } } : {},
                    endDate ? { createdAt: { lte: new Date(String(endDate)) } } : {}
                ]
            },
            include: {
                patient: { 
                    select: { 
                        name: true, 
                        patientNumber: true,
                        user: { select: { name: true } }
                    } 
                },
                planning: { select: { title: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(treatments);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao gerar relatório de tratamentos' });
    }
};
