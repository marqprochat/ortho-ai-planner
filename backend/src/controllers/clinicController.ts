import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';

export const getClinics = async (req: AuthRequest, res: Response) => {
    try {
        const { userId, tenantId, user } = req;

        // Super Admins see all clinics in their tenant
        if (user?.isSuperAdmin) {
            const clinics = await prisma.clinic.findMany({
                where: { tenantId }
            });
            return res.json(clinics);
        }

        // Regular users only see clinics they're assigned to
        const userClinics = await prisma.userClinic.findMany({
            where: { userId },
            include: { clinic: true }
        });

        const clinics = userClinics.map(uc => uc.clinic);
        res.json(clinics);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch clinics' });
    }
};

export const createClinic = async (req: AuthRequest, res: Response) => {
    try {
        const {
            name,
            address,
            tenantId: bodyTenantId,
            nickname,
            logoUrl,
            cro,
            website,
            zipCode,
            street,
            number,
            complement,
            district,
            city,
            state
        } = req.body;

        // Use tenantId from body if provided (super admin case), otherwise use logged-in user's tenantId
        const tenantId = bodyTenantId || req.tenantId;

        if (!tenantId) {
            return res.status(400).json({ error: 'Tenant ID is required' });
        }

        const clinic = await prisma.clinic.create({
            data: {
                name,
                address,
                tenantId,
                nickname,
                logoUrl,
                cro,
                website,
                zipCode,
                street,
                number,
                complement,
                district,
                city,
                state
            }
        });
        res.json(clinic);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create clinic' });
    }
};

export const updateClinic = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const {
            name,
            address,
            nickname,
            logoUrl,
            cro,
            website,
            zipCode,
            street,
            number,
            complement,
            district,
            city,
            state
        } = req.body;

        const clinic = await prisma.clinic.update({
            where: { id },
            data: {
                name,
                address,
                nickname,
                logoUrl,
                cro,
                website,
                zipCode,
                street,
                number,
                complement,
                district,
                city,
                state
            }
        });
        res.json(clinic);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update clinic' });
    }
};

export const deleteClinic = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.clinic.delete({ where: { id } });
        res.json({ message: 'Clinic deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete clinic' });
    }
};
