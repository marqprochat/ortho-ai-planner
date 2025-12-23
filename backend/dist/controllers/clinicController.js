"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteClinic = exports.updateClinic = exports.createClinic = exports.getClinics = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const getClinics = async (req, res) => {
    try {
        const { userId, tenantId, user } = req;
        // Super Admins see all clinics in their tenant
        if (user?.isSuperAdmin) {
            const clinics = await prisma_1.default.clinic.findMany({
                where: { tenantId }
            });
            return res.json(clinics);
        }
        // Regular users only see clinics they're assigned to
        const userClinics = await prisma_1.default.userClinic.findMany({
            where: { userId },
            include: { clinic: true }
        });
        const clinics = userClinics.map(uc => uc.clinic);
        res.json(clinics);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch clinics' });
    }
};
exports.getClinics = getClinics;
const createClinic = async (req, res) => {
    try {
        const { name, address, tenantId: bodyTenantId } = req.body;
        // Use tenantId from body if provided (super admin case), otherwise use logged-in user's tenantId
        const tenantId = bodyTenantId || req.tenantId;
        if (!tenantId) {
            return res.status(400).json({ error: 'Tenant ID is required' });
        }
        const clinic = await prisma_1.default.clinic.create({
            data: {
                name,
                address,
                tenantId
            }
        });
        res.json(clinic);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create clinic' });
    }
};
exports.createClinic = createClinic;
const updateClinic = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, address } = req.body;
        const clinic = await prisma_1.default.clinic.update({
            where: { id },
            data: { name, address }
        });
        res.json(clinic);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update clinic' });
    }
};
exports.updateClinic = updateClinic;
const deleteClinic = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma_1.default.clinic.delete({ where: { id } });
        res.json({ message: 'Clinic deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete clinic' });
    }
};
exports.deleteClinic = deleteClinic;
