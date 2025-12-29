import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/authMiddleware';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me';
const JWT_EXPIRES_IN = '7d';

// POST /api/auth/register
export const register = async (req: Request, res: Response) => {
    try {
        const { email, password, name, tenantName } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, senha e nome são obrigatórios' });
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'Usuário já existe com este email' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create tenant if tenantName provided, otherwise use default
        let tenant = await prisma.tenant.findFirst();
        if (!tenant) {
            tenant = await prisma.tenant.create({
                data: { name: tenantName || 'Clínica Principal' }
            });
        }

        // Check if this is the first user (will be super admin)
        const userCount = await prisma.user.count();
        const isFirstUser = userCount === 0;

        // Create user
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                tenantId: tenant.id,
                isSuperAdmin: isFirstUser
            },
            select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
                isSuperAdmin: true,
                tenantId: true,
                tenant: { select: { id: true, name: true } }
            }
        });

        // If it's the first user, also try to give them Admin role for Portal and Planner if they exist
        if (isFirstUser) {
            try {
                const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
                const portalApp = await prisma.application.findUnique({ where: { name: 'portal' } });
                const plannerApp = await prisma.application.findUnique({ where: { name: 'planner' } });

                if (adminRole) {
                    if (portalApp) {
                        await prisma.userAppAccess.create({
                            data: {
                                userId: user.id,
                                applicationId: portalApp.id,
                                roleId: adminRole.id
                            }
                        });
                    }
                    if (plannerApp) {
                        await prisma.userAppAccess.create({
                            data: {
                                userId: user.id,
                                applicationId: plannerApp.id,
                                roleId: adminRole.id
                            }
                        });
                    }
                }
            } catch (roleError) {
                console.error('Error assigning initial roles:', roleError);
                // Don't fail registration if role assignment fails
            }
        }

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, tenantId: user.tenantId, isSuperAdmin: user.isSuperAdmin },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        return res.status(201).json({ user, token });
    } catch (error) {
        console.error('Register error:', error);
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
};

// POST /api/auth/login
export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                tenant: { select: { id: true, name: true } },
                appAccess: {
                    include: {
                        application: true,
                        role: {
                            include: {
                                permissions: true
                            }
                        }
                    }
                }
            }
        });

        if (!user) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, tenantId: user.tenantId },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Return user data (without password)
        const { password: _, ...userWithoutPassword } = user;
        return res.json({ user: userWithoutPassword, token });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
};

// GET /api/auth/me
export const getMe = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ error: 'Não autenticado' });
        }

        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            include: {
                tenant: { select: { id: true, name: true } },
                appAccess: {
                    include: {
                        application: true,
                        role: {
                            include: {
                                permissions: true
                            }
                        }
                    }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        const { password: _, ...userWithoutPassword } = user;
        return res.json({ user: userWithoutPassword });
    } catch (error) {
        console.error('GetMe error:', error);
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
};
