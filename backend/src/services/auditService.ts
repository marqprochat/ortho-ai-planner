import { Request } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';

export interface AuditLogInput {
    tenantId?: string | null;
    clinicId?: string | null;
    userId?: string | null;
    userName?: string | null;
    userEmail?: string | null;
    action: 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED' | 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT';
    resource: 'AUTH' | 'PATIENT' | 'PLANNING' | 'CONTRACT' | 'TREATMENT' | 'USER' | 'CLINIC' | 'REPORT' | 'AI' | 'DISPARO';
    resourceId?: string | null;
    details?: any;
    ipAddress?: string | null;
    userAgent?: string | null;
}

/**
 * Extrai o IP real do cliente, considerando proxies reversos (Nginx, Traefik, Cloudflare).
 */
export function getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
        return forwarded[0].trim();
    }
    return req.socket?.remoteAddress || req.ip || 'unknown';
}

/**
 * Extrai metadados do usuário e conexão a partir do AuthRequest.
 */
export function getAuditMetadataFromRequest(req: AuthRequest) {
    const user = req.user;
    return {
        tenantId: req.tenantId || user?.tenantId || null,
        clinicId: req.clinicId || null,
        userId: req.userId || user?.id || null,
        userName: user?.name || null,
        userEmail: user?.email || null,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || null,
    };
}

/**
 * Grava um registro de auditoria de forma assíncrona desacoplada (não bloqueia a resposta HTTP).
 */
export function logAudit(data: AuditLogInput): void {
    // Executa em background para manter a latência da requisição mínima
    setImmediate(async () => {
        try {
            await (prisma as any).auditLog.create({
                data: {
                    tenantId: data.tenantId || null,
                    clinicId: data.clinicId || null,
                    userId: data.userId || null,
                    userName: data.userName || null,
                    userEmail: data.userEmail || null,
                    action: data.action,
                    resource: data.resource,
                    resourceId: data.resourceId ? String(data.resourceId) : null,
                    details: data.details !== undefined ? data.details : null,
                    ipAddress: data.ipAddress || null,
                    userAgent: data.userAgent ? String(data.userAgent).slice(0, 500) : null,
                }
            });
        } catch (error) {
            console.error('⚠️ [AuditLog] Erro ao persistir registro de auditoria:', error);
        }
    });
}
