import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';

// Get all patients for the logged-in dentist, filtered by selected clinic
export const getPatients = async (req: AuthRequest, res: Response) => {
    try {
        const { userId, tenantId, clinicId } = req;

        if (!clinicId) {
            return res.status(400).json({ error: 'Clínica não selecionada' });
        }

        const patients = await prisma.patient.findMany({
            where: {
                tenantId,
                userId, // Filter by dentist
                clinicId // Filter by selected clinic
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
export const createPatient = async (req: AuthRequest, res: Response) => {
    try {
        const { name, email, phone, birthDate, externalId } = req.body;
        const { userId, tenantId, clinicId } = req;

        if (!clinicId) {
            return res.status(400).json({ error: 'Clínica não selecionada' });
        }

        const patient = await prisma.patient.create({
            data: {
                name,
                email,
                phone,
                externalId,
                birthDate: birthDate ? new Date(birthDate) : null,
                tenantId: tenantId!,
                userId: userId!, // Assign to logged-in dentist
                clinicId: clinicId
            }
        });

        res.status(201).json(patient);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao criar paciente' });
    }
};

// Find existing patient or create new one (prevents duplicates)
export const findOrCreatePatient = async (req: AuthRequest, res: Response) => {
    try {
        const { name, email, phone, birthDate, externalId } = req.body;
        const { userId, tenantId, clinicId } = req;

        if (!clinicId) {
            return res.status(400).json({ error: 'Clínica não selecionada' });
        }

        if (!name) {
            return res.status(400).json({ error: 'Nome do paciente é obrigatório' });
        }

        // Build search criteria - match by name and optionally phone/birthDate
        const whereClause: any = {
            tenantId,
            userId,
            clinicId, // Ensure we only find in current clinic? Or global?
            // "trabalhar com os dados... somente dessa clinica" implies creating duplicates if patient goes to another clinic?
            // Or shared? If shared, clinicId on patient is tricky.
            // Requirement said "data of apps must be of some clinic".
            // Let's assume STRICT isolation. Same patient in 2 clinics = 2 records.
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
                tenantId: tenantId!,
                userId: userId!,
                clinicId: clinicId
            }
        });

        res.status(201).json({ patient, isNew: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar/criar paciente' });
    }
};


// Get a single patient
export const getPatient = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { userId, tenantId, clinicId } = req;

        const patient = await prisma.patient.findFirst({
            where: {
                id,
                tenantId,
                userId, // Ensure dentist can only see own patients
                clinicId // Ensure patient belongs to context clinic
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
export const updatePatient = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { name, email, phone, birthDate } = req.body;
        const { userId, clinicId } = req;

        // Verify ownership and clinic context
        const existing = await prisma.patient.findFirst({
            where: { id, userId, clinicId }
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
                // Do not update clinicId usually
            }
        });

        res.json(patient);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao atualizar paciente' });
    }
};
