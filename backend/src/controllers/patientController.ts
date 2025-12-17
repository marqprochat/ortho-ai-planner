import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get all patients for the user's tenant
export const getPatients = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const patients = await prisma.patient.findMany({
            where: {
                tenantId: user.tenantId
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        res.json(patients);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar pacientes' });
    }
};

// Create a new patient
export const createPatient = async (req: Request, res: Response) => {
    try {
        const { name, email, phone, birthDate } = req.body;
        const user = (req as any).user;

        const patient = await prisma.patient.create({
            data: {
                name,
                email,
                phone,
                birthDate: birthDate ? new Date(birthDate) : null,
                tenantId: user.tenantId
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
                tenantId: user.tenantId
            },
            include: {
                plannings: true
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
