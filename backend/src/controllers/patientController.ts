import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get all patients for the logged-in dentist
export const getPatients = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const patients = await prisma.patient.findMany({
            where: {
                tenantId: user.tenantId,
                userId: user.id // Filter by dentist
            },
            include: {
                _count: {
                    select: { plannings: true, contracts: true }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        res.json(patients);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar pacientes' });
    }
};

// Create a new patient
export const createPatient = async (req: Request, res: Response) => {
    try {
        const { name, email, phone, birthDate, clinicId } = req.body;
        const user = (req as any).user;

        const patient = await prisma.patient.create({
            data: {
                name,
                email,
                phone,
                birthDate: birthDate ? new Date(birthDate) : null,
                tenantId: user.tenantId,
                userId: user.id, // Assign to logged-in dentist
                clinicId: clinicId || null
            }
        });

        res.status(201).json(patient);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao criar paciente' });
    }
};

// Get a single patient
export const getPatient = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as any).user;

        const patient = await prisma.patient.findFirst({
            where: {
                id,
                tenantId: user.tenantId,
                userId: user.id // Ensure dentist can only see own patients
            },
            include: {
                plannings: {
                    orderBy: { createdAt: 'desc' }
                },
                contracts: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!patient) {
            return res.status(404).json({ error: 'Paciente não encontrado' });
        }

        res.json(patient);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar paciente' });
    }
};

// Update a patient
export const updatePatient = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, email, phone, birthDate, clinicId } = req.body;
        const user = (req as any).user;

        // Verify ownership
        const existing = await prisma.patient.findFirst({
            where: { id, userId: user.id }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Paciente não encontrado' });
        }

        const patient = await prisma.patient.update({
            where: { id },
            data: {
                name,
                email,
                phone,
                birthDate: birthDate ? new Date(birthDate) : null,
                clinicId: clinicId || null
            }
        });

        res.json(patient);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao atualizar paciente' });
    }
};
