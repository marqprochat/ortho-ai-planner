import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get all patients for the logged-in dentist
export const getPatients = async (req: Request, res: Response) => {
    try {
        const { userId, tenantId } = req as any;
        const patients = await prisma.patient.findMany({
            where: {
                tenantId,
                userId // Filter by dentist
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
        const { name, email, phone, birthDate, clinicId, externalId } = req.body;
        const { userId, tenantId } = req as any;

        const patient = await prisma.patient.create({
            data: {
                name,
                email,
                phone,
                externalId,
                birthDate: birthDate ? new Date(birthDate) : null,
                tenantId,
                userId, // Assign to logged-in dentist
                clinicId: clinicId || null
            }
        });

        res.status(201).json(patient);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao criar paciente' });
    }
};

// Find existing patient or create new one (prevents duplicates)
export const findOrCreatePatient = async (req: Request, res: Response) => {
    try {
        const { name, email, phone, birthDate, clinicId, externalId } = req.body;
        const { userId, tenantId } = req as any;

        if (!name) {
            return res.status(400).json({ error: 'Nome do paciente é obrigatório' });
        }

        // Build search criteria - match by name and optionally phone/birthDate
        const whereClause: any = {
            tenantId,
            userId,
            name: name.trim()
        };

        // Add phone to search criteria if provided
        if (phone) {
            whereClause.phone = phone;
        }

        // Add birthDate to search criteria if provided
        if (birthDate) {
            whereClause.birthDate = new Date(birthDate);
        }

        // Search for existing patient
        const existing = await prisma.patient.findFirst({
            where: whereClause
        });

        if (existing) {
            return res.json({ patient: existing, isNew: false });
        }

        // Create new patient
        const patient = await prisma.patient.create({
            data: {
                name: name.trim(),
                email,
                phone,
                externalId,
                birthDate: birthDate ? new Date(birthDate) : null,
                tenantId,
                userId,
                clinicId: clinicId || null
            }
        });

        res.status(201).json({ patient, isNew: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar/criar paciente' });
    }
};


// Get a single patient
export const getPatient = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { userId, tenantId } = req as any;

        const patient = await prisma.patient.findFirst({
            where: {
                id,
                tenantId,
                userId // Ensure dentist can only see own patients
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
        const { userId, tenantId } = req as any;

        // Verify ownership
        const existing = await prisma.patient.findFirst({
            where: { id, userId }
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
