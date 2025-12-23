"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteContract = exports.getAllContracts = exports.getContract = exports.getPatientContracts = exports.createContract = void 0;
const authMiddleware_1 = require("../middleware/authMiddleware");
const prisma_1 = __importDefault(require("../lib/prisma"));
// Create a new contract
const createContract = async (req, res) => {
    try {
        const { patientId, content, logoUrl } = req.body;
        const { tenantId, userId, clinicId } = req;
        const canManageAll = (0, authMiddleware_1.hasPermission)(req.user, 'manage', 'patient');
        // Verify patient belongs to tenant and user (unless admin)
        const patient = await prisma_1.default.patient.findFirst({
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
        const contract = await prisma_1.default.contract.create({
            data: {
                patientId,
                content,
                logoUrl: logoUrl || null
            }
        });
        res.status(201).json(contract);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao criar contrato' });
    }
};
exports.createContract = createContract;
// Get contracts for a patient
const getPatientContracts = async (req, res) => {
    try {
        const { patientId } = req.params;
        const { tenantId, userId, clinicId } = req;
        const canManageAll = (0, authMiddleware_1.hasPermission)(req.user, 'manage', 'patient');
        // Verify patient belongs to tenant and user (unless admin)
        const patient = await prisma_1.default.patient.findFirst({
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
        const contracts = await prisma_1.default.contract.findMany({
            where: { patientId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(contracts);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar contratos' });
    }
};
exports.getPatientContracts = getPatientContracts;
// Get a single contract
const getContract = async (req, res) => {
    try {
        const { id } = req.params;
        const { tenantId, userId, clinicId } = req;
        const canManageAll = (0, authMiddleware_1.hasPermission)(req.user, 'manage', 'patient');
        const contract = await prisma_1.default.contract.findFirst({
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
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar contrato' });
    }
};
exports.getContract = getContract;
// Get all contracts for tenant/clinic
const getAllContracts = async (req, res) => {
    try {
        const { tenantId, clinicId, userId } = req;
        const canManageAll = (0, authMiddleware_1.hasPermission)(req.user, 'manage', 'patient');
        const contracts = await prisma_1.default.contract.findMany({
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
    }
    catch (error) {
        console.error('Error fetching all contracts:', error);
        res.status(500).json({ error: 'Erro ao buscar todos os contratos' });
    }
};
exports.getAllContracts = getAllContracts;
// Delete a contract
const deleteContract = async (req, res) => {
    try {
        const { id } = req.params;
        const { tenantId, userId, clinicId } = req;
        const canManageAll = (0, authMiddleware_1.hasPermission)(req.user, 'manage', 'patient'); // Using manage patient as fallback
        const contract = await prisma_1.default.contract.findFirst({
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
        await prisma_1.default.contract.delete({
            where: { id }
        });
        res.status(204).send();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao excluir contrato' });
    }
};
exports.deleteContract = deleteContract;
