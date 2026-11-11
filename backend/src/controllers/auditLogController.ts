import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import prisma from '../lib/prisma';

export const getAuditLogs = async (req: AuthRequest, res: Response) => {
    try {
        const {
            page = '1',
            limit = '25',
            startDate,
            endDate,
            action,
            resource,
            userId,
            search,
            clinicId,
        } = req.query;

        const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 25));
        const skip = (pageNum - 1) * limitNum;

        const where: any = {};

        // Se não for superAdmin, isola no tenant do usuário logado
        if (!req.user?.isSuperAdmin) {
            where.tenantId = req.tenantId;
        } else if (req.query.tenantId) {
            where.tenantId = req.query.tenantId as string;
        }

        if (clinicId) {
            where.clinicId = clinicId as string;
        }

        if (userId) {
            where.userId = userId as string;
        }

        if (action) {
            where.action = action as string;
        }

        if (resource) {
            where.resource = resource as string;
        }

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) {
                where.createdAt.gte = new Date(startDate as string);
            }
            if (endDate) {
                // Até o fim do dia se vier só a data YYYY-MM-DD
                const end = new Date(endDate as string);
                if ((endDate as string).length === 10) {
                    end.setHours(23, 59, 59, 999);
                }
                where.createdAt.lte = end;
            }
        }

        if (search) {
            const searchStr = String(search).trim();
            where.OR = [
                { userName: { contains: searchStr, mode: 'insensitive' } },
                { userEmail: { contains: searchStr, mode: 'insensitive' } },
                { resourceId: { contains: searchStr, mode: 'insensitive' } },
                { ipAddress: { contains: searchStr, mode: 'insensitive' } },
            ];
        }

        const [total, logs] = await Promise.all([
            (prisma as any).auditLog.count({ where }),
            (prisma as any).auditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum,
            }),
        ]);

        return res.json({
            data: logs,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    } catch (error) {
        console.error('Erro ao buscar logs de auditoria:', error);
        return res.status(500).json({ error: 'Erro ao buscar logs de auditoria' });
    }
};

export const getAuditStats = async (req: AuthRequest, res: Response) => {
    try {
        const whereTenant = req.user?.isSuperAdmin ? {} : { tenantId: req.tenantId };
        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const [total24h, logins24h, patientActions24h] = await Promise.all([
            (prisma as any).auditLog.count({
                where: {
                    ...whereTenant,
                    createdAt: { gte: last24h },
                },
            }),
            (prisma as any).auditLog.count({
                where: {
                    ...whereTenant,
                    action: 'LOGIN',
                    createdAt: { gte: last24h },
                },
            }),
            (prisma as any).auditLog.count({
                where: {
                    ...whereTenant,
                    resource: 'PATIENT',
                    createdAt: { gte: last24h },
                },
            }),
        ]);

        return res.json({
            last24h: {
                total: total24h,
                logins: logins24h,
                patientActions: patientActions24h,
            },
        });
    } catch (error) {
        console.error('Erro ao buscar estatísticas de auditoria:', error);
        return res.status(500).json({ error: 'Erro ao carregar estatísticas' });
    }
};
