import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, hasPermission } from '../middleware/authMiddleware';

// Get all patients for the logged-in dentist, filtered by selected clinic
export const getPatients = async (req: AuthRequest, res: Response) => {
    try {
        const { userId, tenantId, clinicId } = req;

        if (!clinicId) {
            return res.status(400).json({ error: 'Clínica não selecionada' });
        }

        const canManageAll = hasPermission(req.user, 'manage', 'patient');

        const patients = await prisma.patient.findMany({
            where: {
                tenantId,
                clinicId,
                ...(canManageAll ? {} : { userId }) // Filter by dentist if not admin
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
        const { name, email, phone, birthDate, externalId, patientNumber, insurance } = req.body;
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
                patientNumber,
                insurance,
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
        const { name, email, phone, birthDate, externalId, patientNumber, insurance } = req.body;
        const { userId, tenantId, clinicId } = req;

        if (!clinicId) {
            return res.status(400).json({ error: 'Clínica não selecionada' });
        }

        if (!name) {
            return res.status(400).json({ error: 'Nome do paciente é obrigatório' });
        }

        const canManageAll = hasPermission(req.user, 'manage', 'patient');

        // Build search criteria - match by name and optionally phone/birthDate
        const whereClause: any = {
            tenantId,
            clinicId,
            ...(canManageAll ? {} : { userId }), // Search clinic-wide if admin, else only own
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
                patientNumber,
                insurance,
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

        const canManageAll = hasPermission(req.user, 'manage', 'patient');

        const patient = await prisma.patient.findFirst({
            where: {
                id,
                tenantId,
                clinicId,
                ...(canManageAll ? {} : { userId }) // Ensure dentist can only see own unless admin
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
        const { name, email, phone, birthDate, patientNumber, insurance } = req.body;
        const { userId, clinicId } = req;

        const canManageAll = hasPermission(req.user, 'manage', 'patient');

        // Verify ownership and clinic context
        const existing = await prisma.patient.findFirst({
            where: {
                id,
                clinicId,
                ...(canManageAll ? {} : { userId })
            }
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
                patientNumber,
                insurance,
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

// Delete a patient
export const deletePatient = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { userId, clinicId } = req;

        const canManageAll = hasPermission(req.user, 'manage', 'patient');

        // Verify ownership and clinic context before delete
        const existing = await prisma.patient.findFirst({
            where: {
                id,
                clinicId,
                ...(canManageAll ? {} : { userId })
            }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Paciente não encontrado' });
        }

        await prisma.patient.delete({
            where: { id }
        });

        res.status(204).send();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao excluir paciente' });
    }
};
