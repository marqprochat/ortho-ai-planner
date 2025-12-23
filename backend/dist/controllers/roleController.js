"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRole = exports.updateRole = exports.createRole = exports.getRoles = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const getRoles = async (req, res) => {
    try {
        const roles = await prisma_1.default.role.findMany({
            include: {
                permissions: true,
            },
        });
        res.json(roles);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch roles' });
    }
};
exports.getRoles = getRoles;
const createRole = async (req, res) => {
    try {
        const { name, description, permissionIds } = req.body;
        const role = await prisma_1.default.role.create({
            data: {
                name,
                description,
                permissions: permissionIds ? {
                    connect: permissionIds.map((id) => ({ id }))
                } : undefined
            },
            include: {
                permissions: true
            }
        });
        res.json(role);
    }
    catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Já existe um perfil com este nome.' });
        }
        console.error('Error creating role:', error);
        res.status(500).json({ error: 'Failed to create role' });
    }
};
exports.createRole = createRole;
const updateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, permissionIds } = req.body;
        // construct update data
        const updateData = { name, description };
        if (permissionIds) {
            updateData.permissions = {
                set: permissionIds.map((pid) => ({ id: pid }))
            };
        }
        const role = await prisma_1.default.role.update({
            where: { id },
            data: updateData,
            include: { permissions: true }
        });
        res.json(role);
    }
    catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Já existe um perfil com este nome.' });
        }
        console.error('Error updating role:', error);
        res.status(500).json({ error: 'Failed to update role' });
    }
};
exports.updateRole = updateRole;
const deleteRole = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma_1.default.role.delete({ where: { id } });
        res.json({ message: 'Role deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete role' });
    }
};
exports.deleteRole = deleteRole;
