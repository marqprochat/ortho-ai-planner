import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const getPermissions = async (req: Request, res: Response) => {
    try {
        const permissions = await prisma.permission.findMany({
            include: { application: true }
        });
        res.json(permissions);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch permissions' });
    }
};
