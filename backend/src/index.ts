import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { register, login, getMe } from './controllers/authController';
import { authMiddleware } from './middleware/authMiddleware';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
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
