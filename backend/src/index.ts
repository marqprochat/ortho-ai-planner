import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import prisma from './lib/prisma';

// Import Controllers
import { register, login, getMe } from './controllers/authController';
import { getPatients, createPatient, getPatient, updatePatient, findOrCreatePatient, deletePatient, transferPatient } from './controllers/patientController';
import { getPlannings, createPlanning, updatePlanning, getAllPlannings, deletePlanning } from './controllers/planningController';
import { getAllTreatments, getTreatment, getTreatmentById, createTreatment, updateTreatment, deleteTreatment } from './controllers/treatmentController';
import { createContract, getPatientContracts, getContract, getAllContracts, deleteContract, signContract } from './controllers/contractController';
import { getPermissions } from './controllers/permissionController';
import { getRoles, createRole, updateRole, deleteRole } from './controllers/roleController';
import { getClinics, createClinic, updateClinic, deleteClinic } from './controllers/clinicController';
import { getUsers, createUser as createAdminUser, updateUser, deleteUser } from './controllers/userController';
import { listKeys, createKey, updateKey, deleteKey } from './controllers/aiKeyController';
import { generateCompletion } from './controllers/aiController';
import { getPatientsReport, getPlanningsReport, getContractsReport, getTreatmentsReport } from './controllers/reportController';
import { broadcastGlobal, getMyNotifications, markAsRead, getAutomationConfigs, updateAutomationConfig } from './controllers/NotificationController';
import { initCronJobs } from './jobs/notificationCron';

// Import Middleware
import { authMiddleware, requireAppAccess, requirePermission, requireSuperAdmin } from './middleware/authMiddleware';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy: Essencial para que o Express entenda o protocolo HTTPS vindo do Traefik/EasyPanel
app.set('trust proxy', true);

app.use(cors({
    origin: '*', // Permite qualquer origem (Testes)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Clinic-Id'],
    exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
app.post('/api/patients/:id/transfer', authMiddleware, requireAppAccess('planner'), requirePermission('write', 'patient'), transferPatient);

// Planning Routes
app.get('/api/patients/:patientId/plannings', authMiddleware, requireAppAccess('planner'), requirePermission('read', 'planning'), getPlannings);
app.get('/api/plannings', authMiddleware, requireAppAccess('planner'), requirePermission('read', 'planning'), getAllPlannings);
app.post('/api/plannings', authMiddleware, requireAppAccess('planner'), requirePermission('write', 'planning'), createPlanning);
app.put('/api/plannings/:id', authMiddleware, requireAppAccess('planner'), requirePermission('write', 'planning'), updatePlanning);
app.delete('/api/plannings/:id', authMiddleware, requireAppAccess('planner'), requirePermission('delete', 'planning'), deletePlanning);

// Treatment Routes
app.get('/api/treatments', authMiddleware, requireAppAccess('planner'), requirePermission('read', 'planning'), getAllTreatments);
app.get('/api/treatments/:id', authMiddleware, requireAppAccess('planner'), requirePermission('read', 'planning'), getTreatmentById);
app.get('/api/plannings/:planningId/treatment', authMiddleware, requireAppAccess('planner'), requirePermission('read', 'planning'), getTreatment);
app.post('/api/treatments', authMiddleware, requireAppAccess('planner'), requirePermission('write', 'planning'), createTreatment);
app.put('/api/treatments/:id', authMiddleware, requireAppAccess('planner'), requirePermission('write', 'planning'), updateTreatment);
app.delete('/api/treatments/:id', authMiddleware, requireAppAccess('planner'), requirePermission('delete', 'planning'), deleteTreatment);

// Contract Routes
app.post('/api/contracts', authMiddleware, requireAppAccess('planner'), requirePermission('write', 'contract'), createContract);
app.get('/api/contracts', authMiddleware, requireAppAccess('planner'), requirePermission('read', 'contract'), getAllContracts);
app.get('/api/patients/:patientId/contracts', authMiddleware, requireAppAccess('planner'), requirePermission('read', 'contract'), getPatientContracts);
app.get('/api/contracts/:id', authMiddleware, requireAppAccess('planner'), requirePermission('read', 'contract'), getContract);
app.delete('/api/contracts/:id', authMiddleware, requireAppAccess('planner'), requirePermission('delete', 'contract'), deleteContract);
app.patch('/api/contracts/:id/sign', authMiddleware, requireAppAccess('planner'), requirePermission('write', 'contract'), signContract);

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

// AI Routes
app.post('/api/ai/completion', authMiddleware, requireAppAccess('planner'), generateCompletion);

// Report Routes
app.get('/api/reports/patients', authMiddleware, requireAppAccess('planner'), requirePermission('read', 'report_pacientes'), getPatientsReport);
app.get('/api/reports/plannings', authMiddleware, requireAppAccess('planner'), requirePermission('read', 'report_planejamentos'), getPlanningsReport);
app.get('/api/reports/contracts', authMiddleware, requireAppAccess('planner'), requirePermission('read', 'report_financeiro'), getContractsReport);
app.get('/api/reports/treatments', authMiddleware, requireAppAccess('planner'), requirePermission('read', 'report_tratamentos'), getTreatmentsReport);

// AI API Key Routes (Super Admin)

app.get('/api/ai-keys', authMiddleware, requireSuperAdmin, listKeys);
app.post('/api/ai-keys', authMiddleware, requireSuperAdmin, createKey);
app.put('/api/ai-keys/:id', authMiddleware, requireSuperAdmin, updateKey);
app.delete('/api/ai-keys/:id', authMiddleware, requireSuperAdmin, deleteKey);

// Notification Routes
app.get('/api/notifications', authMiddleware, getMyNotifications);
app.post('/api/notifications/:id/read', authMiddleware, markAsRead);
app.post('/api/admin/notifications/broadcast', authMiddleware, requireSuperAdmin, broadcastGlobal);
app.get('/api/admin/notifications/config', authMiddleware, requireSuperAdmin, getAutomationConfigs);
app.put('/api/admin/notifications/config/:type', authMiddleware, requireSuperAdmin, updateAutomationConfig);

// Legacy routes (for older frontend builds)
app.get('/api/admin/ai-keys', authMiddleware, requireSuperAdmin, listKeys);
app.post('/api/admin/ai-keys', authMiddleware, requireSuperAdmin, createKey);
app.put('/api/admin/ai-keys/:id', authMiddleware, requireSuperAdmin, updateKey);
app.delete('/api/admin/ai-keys/:id', authMiddleware, requireSuperAdmin, deleteKey);

// Start Server
app.listen(PORT, async () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    try {
        await prisma.$connect();
        console.log('✅ Database connected successfully');
        
        // Initialize jobs
        initCronJobs();
    } catch (error) {
        console.error('❌ Database connection failed', error);
    }
});
