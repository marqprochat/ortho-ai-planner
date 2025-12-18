import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const getRoles = async (req: Request, res: Response) => {
    try {
        const roles = await prisma.role.findMany({
            include: {
                permissions: true,
            },
        });
        res.json(roles);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch roles' });
    }
};

export const createRole = async (req: Request, res: Response) => {
    try {
        const { name, description, permissionIds } = req.body;

        const role = await prisma.role.create({
            data: {
                name,
                description,
                permissions: permissionIds ? {
                    connect: permissionIds.map((id: string) => ({ id }))
                } : undefined
            },
            include: {
                permissions: true
            }
        });

        res.json(role);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Já existe um perfil com este nome.' });
        }
        console.error('Error creating role:', error);
        res.status(500).json({ error: 'Failed to create role' });
    }
};

export const updateRole = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, description, permissionIds } = req.body;

        // construct update data
        const updateData: any = { name, description };
        if (permissionIds) {
            updateData.permissions = {
                set: permissionIds.map((pid: string) => ({ id: pid }))
            };
        }

        const role = await prisma.role.update({
            where: { id },
            data: updateData,
            include: { permissions: true }
        });

        res.json(role);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Já existe um perfil com este nome.' });
        }
        console.error('Error updating role:', error);
        res.status(500).json({ error: 'Failed to update role' });
    }
};

export const deleteRole = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.role.delete({ where: { id } });
        res.json({ message: 'Role deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete role' });
    }
};
