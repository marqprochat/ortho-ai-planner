import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import prisma from './lib/prisma';

// Import Controllers
import { register, login, getMe } from './controllers/authController';
import { getPatients, createPatient, getPatient, updatePatient, findOrCreatePatient, deletePatient } from './controllers/patientController';
import { getPlannings, createPlanning, updatePlanning, getAllPlannings, deletePlanning } from './controllers/planningController';
import { createContract, getPatientContracts, getContract, getAllContracts, deleteContract } from './controllers/contractController';
import { getPermissions } from './controllers/permissionController';
import { getRoles, createRole, updateRole, deleteRole } from './controllers/roleController';
import { getClinics, createClinic, updateClinic, deleteClinic } from './controllers/clinicController';
import { getUsers, createUser as createAdminUser, updateUser, deleteUser } from './controllers/userController';

// Import Middleware
import { authMiddleware, requireAppAccess, requirePermission } from './middleware/authMiddleware';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy: Essencial para que o Express entenda o protocolo HTTPS vindo do Traefik/EasyPanel
app.set('trust proxy', true);

// Lista de origens permitidas
const allowedOrigins = [
    'https://portal.dentalkids.com.br',
    'https://planner.dentalkids.com.br',
    'http://localhost:5173',
    'http://localhost:8080'
];

// Configuração CORS robusta
const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
        console.log(`[CORS] Verificando origin: ${origin}`);
        // Permitir requisições sem origin (como mobile apps ou curl)
        if (!origin) {
            return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        // Bloquear requisições de origens não permitidas
        console.warn(`[CORS] Origin não permitida: ${origin}`);
        return callback(new Error(`Não permitido por CORS: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    optionsSuccessStatus: 200, // Para browsers legados
    preflightContinue: false
};

// Aplicar CORS para TODAS as rotas
app.use(cors(corsOptions));

// Handler explícito para preflight OPTIONS em todas as rotas
app.options('*', cors(corsOptions));

app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Auth Routes
app.post('/api/auth/register', register);
app.post('/api/auth/login', login);
app.get('/api/auth/me', authMiddleware, getMe);

// Patient Routes
app.get('/api/patients', authMiddleware, requireAppAccess('planner'), requirePermission('read', 'patient'), getPatients);
app.post('/api/patients', authMiddleware, requireAppAccess('planner'), requirePermission('write', 'patient'), createPatient);
app.post('/api/patients/find-or-create', authMiddleware, requireAppAccess('planner'), requirePermission('write', 'patient'), findOrCreatePatient);
app.get('/api/patients/:id', authMiddleware, requireAppAccess('planner'), requirePermission('read', 'patient'), getPatient);
app.put('/api/patients/:id', authMiddleware, requireAppAccess('planner'), requirePermission('write', 'patient'), updatePatient);
app.delete('/api/patients/:id', authMiddleware, requireAppAccess('planner'), requirePermission('delete', 'patient'), deletePatient);

// Planning Routes
app.get('/api/patients/:patientId/plannings', authMiddleware, requireAppAccess('planner'), requirePermission('read', 'planning'), getPlannings);
app.get('/api/plannings', authMiddleware, requireAppAccess('planner'), requirePermission('read', 'planning'), getAllPlannings);
app.post('/api/plannings', authMiddleware, requireAppAccess('planner'), requirePermission('write', 'planning'), createPlanning);
app.put('/api/plannings/:id', authMiddleware, requireAppAccess('planner'), requirePermission('write', 'planning'), updatePlanning);
app.delete('/api/plannings/:id', authMiddleware, requireAppAccess('planner'), requirePermission('delete', 'planning'), deletePlanning);

// Contract Routes
app.post('/api/contracts', authMiddleware, requireAppAccess('planner'), requirePermission('write', 'contract'), createContract);
app.get('/api/contracts', authMiddleware, requireAppAccess('planner'), requirePermission('read', 'contract'), getAllContracts);
app.get('/api/patients/:patientId/contracts', authMiddleware, requireAppAccess('planner'), requirePermission('read', 'contract'), getPatientContracts);
app.get('/api/contracts/:id', authMiddleware, requireAppAccess('planner'), requirePermission('read', 'contract'), getContract);
app.delete('/api/contracts/:id', authMiddleware, requireAppAccess('planner'), requirePermission('delete', 'contract'), deleteContract);

// Permission & Role Routes
app.get('/api/permissions', authMiddleware, getPermissions);
app.get('/api/roles', authMiddleware, getRoles);
app.post('/api/roles', authMiddleware, createRole);
app.put('/api/roles/:id', authMiddleware, updateRole);
app.delete('/api/roles/:id', authMiddleware, deleteRole);

// Clinic Routes
app.get('/api/clinics', authMiddleware, getClinics);
app.post('/api/clinics', authMiddleware, createClinic);
app.put('/api/clinics/:id', authMiddleware, updateClinic);
app.delete('/api/clinics/:id', authMiddleware, deleteClinic);

// User Management Routes
app.get('/api/users', authMiddleware, getUsers);
app.post('/api/users', authMiddleware, createAdminUser);
app.put('/api/users/:id', authMiddleware, updateUser);
app.delete('/api/users/:id', authMiddleware, deleteUser);

// Start Server
app.listen(PORT, async () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    try {
        await prisma.$connect();
        console.log('✅ Database connected successfully');
    } catch (error) {
        console.error('❌ Database connection failed', error);
    }
});
