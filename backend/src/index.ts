import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import prisma from './lib/prisma';
import { register, login, getMe } from './controllers/authController';
import { authMiddleware } from './middleware/authMiddleware';

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
import { getPatients, createPatient, getPatient, updatePatient, findOrCreatePatient } from './controllers/patientController';
app.get('/api/patients', authMiddleware, getPatients);
app.post('/api/patients', authMiddleware, createPatient);
app.post('/api/patients/find-or-create', authMiddleware, findOrCreatePatient);
app.get('/api/patients/:id', authMiddleware, getPatient);
app.put('/api/patients/:id', authMiddleware, updatePatient);

// Planning Routes
import { getPlannings, createPlanning, updatePlanning } from './controllers/planningController';
app.get('/api/patients/:patientId/plannings', authMiddleware, getPlannings);
app.post('/api/plannings', authMiddleware, createPlanning);
app.put('/api/plannings/:id', authMiddleware, updatePlanning);

// Contract Routes
import { createContract, getPatientContracts, getContract } from './controllers/contractController';
app.post('/api/contracts', authMiddleware, createContract);
app.get('/api/patients/:patientId/contracts', authMiddleware, getPatientContracts);
app.get('/api/contracts/:id', authMiddleware, getContract);

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
