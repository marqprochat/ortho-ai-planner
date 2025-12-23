import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import prisma from './lib/prisma';
import { register, login, getMe } from './controllers/authController';
import { authMiddleware, requireAppAccess, requirePermission } from './middleware/authMiddleware';

dotenv.config();

const app = express();
// const prisma = new PrismaClient(); // Removed local instantiation
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:8080'],
    credentials: true
}));
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
import { getPatients, createPatient, getPatient, updatePatient, findOrCreatePatient, deletePatient } from './controllers/patientController';
app.get('/api/patients', authMiddleware, requireAppAccess('planner'), requirePermission('read', 'patient'), getPatients);
app.post('/api/patients', authMiddleware, requireAppAccess('planner'), requirePermission('write', 'patient'), createPatient);
app.post('/api/patients/find-or-create', authMiddleware, requireAppAccess('planner'), requirePermission('write', 'patient'), findOrCreatePatient);
app.get('/api/patients/:id', authMiddleware, requireAppAccess('planner'), requirePermission('read', 'patient'), getPatient);
app.put('/api/patients/:id', authMiddleware, requireAppAccess('planner'), requirePermission('write', 'patient'), updatePatient);
app.delete('/api/patients/:id', authMiddleware, requireAppAccess('planner'), requirePermission('delete', 'patient'), deletePatient);

// Planning Routes
import { getPlannings, createPlanning, updatePlanning, getAllPlannings, deletePlanning } from './controllers/planningController';
app.get('/api/patients/:patientId/plannings', authMiddleware, requireAppAccess('planner'), requirePermission('read', 'planning'), getPlannings);
app.get('/api/plannings', authMiddleware, requireAppAccess('planner'), requirePermission('read', 'planning'), getAllPlannings);
app.post('/api/plannings', authMiddleware, requireAppAccess('planner'), requirePermission('write', 'planning'), createPlanning);
app.put('/api/plannings/:id', authMiddleware, requireAppAccess('planner'), requirePermission('write', 'planning'), updatePlanning);
app.delete('/api/plannings/:id', authMiddleware, requireAppAccess('planner'), requirePermission('delete', 'planning'), deletePlanning);

// Contract Routes
import { createContract, getPatientContracts, getContract, getAllContracts, deleteContract } from './controllers/contractController';
app.post('/api/contracts', authMiddleware, requireAppAccess('planner'), requirePermission('write', 'contract'), createContract);
app.get('/api/contracts', authMiddleware, requireAppAccess('planner'), requirePermission('read', 'contract'), getAllContracts);
app.get('/api/patients/:patientId/contracts', authMiddleware, requireAppAccess('planner'), requirePermission('read', 'contract'), getPatientContracts);
app.get('/api/contracts/:id', authMiddleware, requireAppAccess('planner'), requirePermission('read', 'contract'), getContract);
app.delete('/api/contracts/:id', authMiddleware, requireAppAccess('planner'), requirePermission('delete', 'contract'), deleteContract);

// Permission & Role Routes
import { getPermissions } from './controllers/permissionController';
import { getRoles, createRole, updateRole, deleteRole } from './controllers/roleController';

app.get('/api/permissions', authMiddleware, getPermissions);
app.get('/api/roles', authMiddleware, getRoles);
app.post('/api/roles', authMiddleware, createRole);
app.put('/api/roles/:id', authMiddleware, updateRole);
app.delete('/api/roles/:id', authMiddleware, deleteRole);

// Clinic Routes
import { getClinics, createClinic, updateClinic, deleteClinic } from './controllers/clinicController';
app.get('/api/clinics', authMiddleware, getClinics);
app.post('/api/clinics', authMiddleware, createClinic);
app.put('/api/clinics/:id', authMiddleware, updateClinic);
app.delete('/api/clinics/:id', authMiddleware, deleteClinic);

// User Management Routes
import { getUsers, createUser as createAdminUser, updateUser, deleteUser } from './controllers/userController';
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
