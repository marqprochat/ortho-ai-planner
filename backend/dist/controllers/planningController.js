"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePlanning = exports.getAllPlannings = exports.updatePlanning = exports.createPlanning = exports.getPlannings = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const authMiddleware_1 = require("../middleware/authMiddleware");
// Get all plannings for a patient
const getPlannings = async (req, res) => {
    try {
        const { patientId } = req.params;
        const { tenantId, clinicId } = req;
        const canManageAll = (0, authMiddleware_1.hasPermission)(req.user, 'manage', 'planning');
        // Verify patient belongs to tenant AND current clinic (and user if not manager)
        const patient = await prisma_1.default.patient.findFirst({
            where: {
                id: patientId,
                tenantId,
                clinicId: clinicId,
                ...(canManageAll ? {} : { userId: req.userId })
            }
        });
        if (!patient) {
            return res.status(404).json({ error: 'Paciente não encontrado' });
        }
        const plannings = await prisma_1.default.planning.findMany({
            where: { patientId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(plannings);
    }
    catch (error) {
        res.status(500).json({ error: 'Erro ao buscar planejamentos' });
    }
};
exports.getPlannings = getPlannings;
// Create a new planning
const createPlanning = async (req, res) => {
    try {
        const { patientId, title, originalReport } = req.body;
        const { tenantId, clinicId } = req; // Proper destructuring from AuthRequest
        const canManageAll = (0, authMiddleware_1.hasPermission)(req.user, 'manage', 'planning');
        // Verify patient belongs to tenant AND current clinic (and user if not manager)
        const patient = await prisma_1.default.patient.findFirst({
            where: {
                id: patientId,
                tenantId,
                clinicId,
                ...(canManageAll ? {} : { userId: req.userId })
            }
        });
        if (!patient) {
            return res.status(404).json({ error: 'Paciente não encontrado' });
        }
        const planning = await prisma_1.default.planning.create({
            data: {
                title,
                originalReport,
                patientId,
                status: 'DRAFT'
            }
        });
        res.status(201).json(planning);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao criar planejamento' });
    }
};
exports.createPlanning = createPlanning;
// Update planning (e.g. save AI response)
const updatePlanning = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, aiResponse, structuredPlan } = req.body;
        const { tenantId, clinicId } = req;
        const canManageAll = (0, authMiddleware_1.hasPermission)(req.user, 'manage', 'planning');
        // Verify ownership via patient->tenant AND clinic (and user if not manager)
        const planning = await prisma_1.default.planning.findFirst({
            where: {
                id,
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
        const updated = await prisma_1.default.planning.update({
            where: { id },
            data: {
                status,
                aiResponse,
                structuredPlan
            }
        });
        res.json(updated);
    }
    catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar planejamento' });
    }
};
exports.updatePlanning = updatePlanning;
// Get all plannings for tenant/clinic
const getAllPlannings = async (req, res) => {
    try {
        const { tenantId, clinicId } = req;
        const canManageAll = (0, authMiddleware_1.hasPermission)(req.user, 'manage', 'planning');
        const plannings = await prisma_1.default.planning.findMany({
            where: {
                patient: {
                    tenantId,
                    clinicId,
                    ...(canManageAll ? {} : { userId: req.userId })
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
        res.json(plannings);
    }
    catch (error) {
        console.error('Error fetching all plannings:', error);
        res.status(500).json({ error: 'Erro ao buscar todos os planejamentos' });
    }
};
exports.getAllPlannings = getAllPlannings;
// Delete a planning
const deletePlanning = async (req, res) => {
    try {
        const { id } = req.params;
        const { tenantId, userId, clinicId } = req;
        const canManageAll = (0, authMiddleware_1.hasPermission)(req.user, 'manage', 'planning');
        // Verify patient ownership (via patient) and clinic context
        const planning = await prisma_1.default.planning.findFirst({
            where: {
                id,
                patient: {
                    tenantId,
                    clinicId,
                    ...(canManageAll ? {} : { userId })
                }
            }
        });
        if (!planning) {
            return res.status(404).json({ error: 'Planejamento não encontrado' });
        }
        await prisma_1.default.planning.delete({
            where: { id }
        });
        res.status(204).send();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao excluir planejamento' });
    }
};
exports.deletePlanning = deletePlanning;
