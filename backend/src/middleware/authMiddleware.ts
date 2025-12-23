import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me';

export interface AuthRequest extends Request {
    userId?: string;
    tenantId?: string;
    clinicId?: string; // Selected clinic context
    user?: any; // populated with full user object including permissions
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        // Allow public access if needed, or enforce here?
        // Usually authMiddleware enforces.
        return res.status(401).json({ error: 'Token não fornecido' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2) {
        return res.status(401).json({ error: 'Token mal formatado' });
    }

    const [scheme, token] = parts;
    if (!/^Bearer$/i.test(scheme)) {
        return res.status(401).json({ error: 'Token mal formatado' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; tenantId: string };
        req.userId = decoded.userId;
        req.tenantId = decoded.tenantId;

        // Fetch user permissions
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            include: {
                appAccess: {
                    include: {
                        application: true,
                        role: {
                            include: { permissions: true }
                        }
                    }
                }
            }
        });

        if (!user) {
            return res.status(401).json({ error: 'Usuário não encontrado' });
        }

        req.user = user;

        // Handle Clinic Context
        const clinicId = req.headers['x-clinic-id'] as string;
        if (clinicId) {
            // Optional: Validate if user has access to this clinic
            // For now, assuming Tenant-wide access, we just check if clinic belongs to same tenant
            // Or simpler: just assignment for MVP
            req.clinicId = clinicId;
        }

        return next();
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido' });
    }
};

export const requirePermission = (action: string, resource: string) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Não autenticado' });

        if (user.isSuperAdmin) return next();

        // Flatten permissions from all roles (across all apps? or specific app logic?)
        // For now, if ANY role has the permission, allow it.
        // Or we might need to check "current app context".
        // Assuming global roles for now based on prompt transparency.

        const hasPermission = user.appAccess?.some((access: any) =>
            access.role?.permissions?.some((p: any) =>
                (p.action === action || p.action === 'manage') &&
                (p.resource === resource || p.resource === 'all')
            )
        );

        if (!hasPermission) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        next();
    };
};

export const requireAppAccess = (appName: string) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Não autenticado' });

        if (user.isSuperAdmin) return next();

        const hasAppAccess = user.appAccess?.some((access: any) =>
            access.application?.name === appName
        );

        if (!hasAppAccess) {
            return res.status(403).json({ error: `Você não tem permissão para acessar o aplicativo ${appName}` });
        }

        next();
    };
};
