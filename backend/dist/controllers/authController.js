"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me';
const JWT_EXPIRES_IN = '7d';
// POST /api/auth/register
const register = async (req, res) => {
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
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        // Create tenant if tenantName provided, otherwise use default
        let tenant = await prisma.tenant.findFirst();
        if (!tenant) {
            tenant = await prisma.tenant.create({
                data: { name: tenantName || 'Clínica Principal' }
            });
        }
        // Create user
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                tenantId: tenant.id
            },
            select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
                tenantId: true,
                tenant: { select: { id: true, name: true } }
            }
        });
        // Generate JWT
        const token = jsonwebtoken_1.default.sign({ userId: user.id, tenantId: user.tenantId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        return res.status(201).json({ user, token });
    }
    catch (error) {
        console.error('Register error:', error);
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
};
exports.register = register;
// POST /api/auth/login
const login = async (req, res) => {
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
        const isValidPassword = await bcryptjs_1.default.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }
        // Generate JWT
        const token = jsonwebtoken_1.default.sign({ userId: user.id, tenantId: user.tenantId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        // Return user data (without password)
        const { password: _, ...userWithoutPassword } = user;
        return res.json({ user: userWithoutPassword, token });
    }
    catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
};
exports.login = login;
// GET /api/auth/me
const getMe = async (req, res) => {
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
    }
    catch (error) {
        console.error('GetMe error:', error);
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
};
exports.getMe = getMe;
