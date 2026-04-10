import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const broadcastGlobal = async (req: Request, res: Response): Promise<void> => {
    try {
        const { title, message, clinicIds } = req.body;
        const tenantId = (req as any).user.tenantId;

        const notification = await prisma.notification.create({
            data: {
                title,
                message,
                type: 'GLOBAL',
                tenantId,
                clinicIds: clinicIds || []
            }
        });

        res.status(201).json(notification);
    } catch (error) {
        console.error('Error broadcasting notification:', error);
        res.status(500).json({ error: 'Failed to broadcast notification' });
    }
};

export const getMyNotifications = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user.id;
        const tenantId = (req as any).user.tenantId;

        // Get user's clinics
        const userClinics = await prisma.userClinic.findMany({
            where: { userId }
        });
        const clinicIds = userClinics.map(uc => uc.clinicId);

        // Fetch notifications for the tenant that are either global (empty clinicIds) or match user's clinics
        const notifications = await prisma.notification.findMany({
            where: {
                tenantId,
                OR: [
                    { clinicIds: { isEmpty: true } },
                    { clinicIds: { hasSome: clinicIds } },
                    { clinicIds: { equals: [] } } // Postgres fallback
                ]
            },
            include: {
                reads: {
                    where: { userId }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Map to include isRead flag
        const notificationsWithReadStatus = notifications.map(n => ({
            ...n,
            isRead: n.reads.length > 0
        }));

        res.json(notificationsWithReadStatus);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};

export const markAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = (req as any).user.id;

        const read = await prisma.notificationRead.create({
            data: {
                notificationId: id,
                userId
            }
        });

        res.json(read);
    } catch (error) {
        // Ignore unique constraint errors if already read
        if ((error as any).code === 'P2002') {
             res.json({ success: true, message: 'Already marked as read' });
             return;
        }
        console.error('Error marking as read:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
};

export const getAutomationConfigs = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = (req as any).user.tenantId;

        const configs = await prisma.notificationAutomationConfig.findMany({
            where: { tenantId }
        });

        res.json(configs);
    } catch (error) {
        console.error('Error fetching configs:', error);
        res.status(500).json({ error: 'Failed to fetch automation configs' });
    }
};

export const updateAutomationConfig = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = (req as any).user.tenantId;
        const { type } = req.params;
        const { isActive, daysConfig, clinicIds } = req.body;

        const config = await prisma.notificationAutomationConfig.upsert({
            where: {
                tenantId_type: {
                    tenantId,
                    type
                }
            },
            update: {
                isActive,
                daysConfig,
                clinicIds: clinicIds || []
            },
            create: {
                tenantId,
                type,
                isActive,
                daysConfig,
                clinicIds: clinicIds || []
            }
        });

        res.json(config);
    } catch (error) {
        console.error('Error updating config:', error);
        res.status(500).json({ error: 'Failed to update automation config' });
    }
};
