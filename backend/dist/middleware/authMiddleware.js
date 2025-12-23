"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAppAccess = exports.requirePermission = exports.hasPermission = exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me';
const authMiddleware = async (req, res, next) => {
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
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        req.tenantId = decoded.tenantId;
        // Fetch user permissions
        const user = await prisma_1.default.user.findUnique({
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
        const clinicId = req.headers['x-clinic-id'];
        if (clinicId) {
            // Optional: Validate if user has access to this clinic
            // For now, assuming Tenant-wide access, we just check if clinic belongs to same tenant
            // Or simpler: just assignment for MVP
            req.clinicId = clinicId;
        }
        return next();
    }
    catch (error) {
        return res.status(401).json({ error: 'Token inválido' });
    }
};
exports.authMiddleware = authMiddleware;
const hasPermission = (user, action, resource) => {
    if (!user)
        return false;
    if (user.isSuperAdmin)
        return true;
    // Flatten permissions from all roles across all apps
    return user.appAccess?.some((access) => access.role?.permissions?.some((p) => (p.action === action || p.action === 'manage') &&
        (p.resource === resource || p.resource === 'all')));
};
exports.hasPermission = hasPermission;
const requirePermission = (action, resource) => {
    return (req, res, next) => {
        if (!(0, exports.hasPermission)(req.user, action, resource)) {
            return res.status(403).json({ error: 'Acesso negado' });
        }
        next();
    };
};
exports.requirePermission = requirePermission;
const requireAppAccess = (appName) => {
    return (req, res, next) => {
        const user = req.user;
        if (!user)
            return res.status(401).json({ error: 'Não autenticado' });
        if (user.isSuperAdmin)
            return next();
        const hasAppAccess = user.appAccess?.some((access) => access.application?.name === appName);
        if (!hasAppAccess) {
            return res.status(403).json({ error: `Você não tem permissão para acessar o aplicativo ${appName}` });
        }
        next();
    };
};
exports.requireAppAccess = requireAppAccess;
