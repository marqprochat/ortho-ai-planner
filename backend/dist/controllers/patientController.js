"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePatient = exports.updatePatient = exports.getPatient = exports.findOrCreatePatient = exports.createPatient = exports.getPatients = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const authMiddleware_1 = require("../middleware/authMiddleware");
// Get all patients for the logged-in dentist, filtered by selected clinic
const getPatients = async (req, res) => {
    try {
        const { userId, tenantId, clinicId } = req;
        if (!clinicId) {
            return res.status(400).json({ error: 'Clínica não selecionada' });
        }
        const canManageAll = (0, authMiddleware_1.hasPermission)(req.user, 'manage', 'patient');
        const patients = await prisma_1.default.patient.findMany({
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
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar pacientes' });
    }
};
exports.getPatients = getPatients;
// Create a new patient
const createPatient = async (req, res) => {
    try {
        const { name, email, phone, birthDate, externalId } = req.body;
        const { userId, tenantId, clinicId } = req;
        if (!clinicId) {
            return res.status(400).json({ error: 'Clínica não selecionada' });
        }
        const patient = await prisma_1.default.patient.create({
            data: {
                name,
                email,
                phone,
                externalId,
                birthDate: birthDate ? new Date(birthDate) : null,
                tenantId: tenantId,
                userId: userId, // Assign to logged-in dentist
                clinicId: clinicId
            }
        });
        res.status(201).json(patient);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao criar paciente' });
    }
};
exports.createPatient = createPatient;
// Find existing patient or create new one (prevents duplicates)
const findOrCreatePatient = async (req, res) => {
    try {
        const { name, email, phone, birthDate, externalId } = req.body;
        const { userId, tenantId, clinicId } = req;
        if (!clinicId) {
            return res.status(400).json({ error: 'Clínica não selecionada' });
        }
        if (!name) {
            return res.status(400).json({ error: 'Nome do paciente é obrigatório' });
        }
        const canManageAll = (0, authMiddleware_1.hasPermission)(req.user, 'manage', 'patient');
        // Build search criteria - match by name and optionally phone/birthDate
        const whereClause = {
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
        const existing = await prisma_1.default.patient.findFirst({
            where: whereClause
        });
        if (existing) {
            return res.json({ patient: existing, isNew: false });
        }
        // Create new patient
        const patient = await prisma_1.default.patient.create({
            data: {
                name: name.trim(),
                email,
                phone,
                externalId,
                birthDate: birthDate ? new Date(birthDate) : null,
                tenantId: tenantId,
                userId: userId,
                clinicId: clinicId
            }
        });
        res.status(201).json({ patient, isNew: true });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar/criar paciente' });
    }
};
exports.findOrCreatePatient = findOrCreatePatient;
// Get a single patient
const getPatient = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, tenantId, clinicId } = req;
        const canManageAll = (0, authMiddleware_1.hasPermission)(req.user, 'manage', 'patient');
        const patient = await prisma_1.default.patient.findFirst({
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
    }
    catch (error) {
        res.status(500).json({ error: 'Erro ao buscar paciente' });
    }
};
exports.getPatient = getPatient;
// Update a patient
const updatePatient = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, phone, birthDate } = req.body;
        const { userId, clinicId } = req;
        const canManageAll = (0, authMiddleware_1.hasPermission)(req.user, 'manage', 'patient');
        // Verify ownership and clinic context
        const existing = await prisma_1.default.patient.findFirst({
            where: {
                id,
                clinicId,
                ...(canManageAll ? {} : { userId })
            }
        });
        if (!existing) {
            return res.status(404).json({ error: 'Paciente não encontrado' });
        }
        const patient = await prisma_1.default.patient.update({
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
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao atualizar paciente' });
    }
};
exports.updatePatient = updatePatient;
// Delete a patient
const deletePatient = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, clinicId } = req;
        const canManageAll = (0, authMiddleware_1.hasPermission)(req.user, 'manage', 'patient');
        // Verify ownership and clinic context before delete
        const existing = await prisma_1.default.patient.findFirst({
            where: {
                id,
                clinicId,
                ...(canManageAll ? {} : { userId })
            }
        });
        if (!existing) {
            return res.status(404).json({ error: 'Paciente não encontrado' });
        }
        await prisma_1.default.patient.delete({
            where: { id }
        });
        res.status(204).send();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao excluir paciente' });
    }
};
exports.deletePatient = deletePatient;
