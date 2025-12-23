"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const prisma_1 = __importDefault(require("./lib/prisma"));
const authController_1 = require("./controllers/authController");
const authMiddleware_1 = require("./middleware/authMiddleware");
dotenv_1.default.config();
const app = (0, express_1.default)();
// const prisma = new PrismaClient(); // Removed local instantiation
const PORT = process.env.PORT || 3000;
// Middleware
app.use((0, cors_1.default)({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:8080'],
    credentials: true
}));
app.use(express_1.default.json());
// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});
// Auth Routes
app.post('/api/auth/register', authController_1.register);
app.post('/api/auth/login', authController_1.login);
app.get('/api/auth/me', authMiddleware_1.authMiddleware, authController_1.getMe);
// Patient Routes
const patientController_1 = require("./controllers/patientController");
app.get('/api/patients', authMiddleware_1.authMiddleware, (0, authMiddleware_1.requireAppAccess)('planner'), (0, authMiddleware_1.requirePermission)('read', 'patient'), patientController_1.getPatients);
app.post('/api/patients', authMiddleware_1.authMiddleware, (0, authMiddleware_1.requireAppAccess)('planner'), (0, authMiddleware_1.requirePermission)('write', 'patient'), patientController_1.createPatient);
app.post('/api/patients/find-or-create', authMiddleware_1.authMiddleware, (0, authMiddleware_1.requireAppAccess)('planner'), (0, authMiddleware_1.requirePermission)('write', 'patient'), patientController_1.findOrCreatePatient);
app.get('/api/patients/:id', authMiddleware_1.authMiddleware, (0, authMiddleware_1.requireAppAccess)('planner'), (0, authMiddleware_1.requirePermission)('read', 'patient'), patientController_1.getPatient);
app.put('/api/patients/:id', authMiddleware_1.authMiddleware, (0, authMiddleware_1.requireAppAccess)('planner'), (0, authMiddleware_1.requirePermission)('write', 'patient'), patientController_1.updatePatient);
app.delete('/api/patients/:id', authMiddleware_1.authMiddleware, (0, authMiddleware_1.requireAppAccess)('planner'), (0, authMiddleware_1.requirePermission)('delete', 'patient'), patientController_1.deletePatient);
// Planning Routes
const planningController_1 = require("./controllers/planningController");
app.get('/api/patients/:patientId/plannings', authMiddleware_1.authMiddleware, (0, authMiddleware_1.requireAppAccess)('planner'), (0, authMiddleware_1.requirePermission)('read', 'planning'), planningController_1.getPlannings);
app.get('/api/plannings', authMiddleware_1.authMiddleware, (0, authMiddleware_1.requireAppAccess)('planner'), (0, authMiddleware_1.requirePermission)('read', 'planning'), planningController_1.getAllPlannings);
app.post('/api/plannings', authMiddleware_1.authMiddleware, (0, authMiddleware_1.requireAppAccess)('planner'), (0, authMiddleware_1.requirePermission)('write', 'planning'), planningController_1.createPlanning);
app.put('/api/plannings/:id', authMiddleware_1.authMiddleware, (0, authMiddleware_1.requireAppAccess)('planner'), (0, authMiddleware_1.requirePermission)('write', 'planning'), planningController_1.updatePlanning);
app.delete('/api/plannings/:id', authMiddleware_1.authMiddleware, (0, authMiddleware_1.requireAppAccess)('planner'), (0, authMiddleware_1.requirePermission)('delete', 'planning'), planningController_1.deletePlanning);
// Contract Routes
const contractController_1 = require("./controllers/contractController");
app.post('/api/contracts', authMiddleware_1.authMiddleware, (0, authMiddleware_1.requireAppAccess)('planner'), (0, authMiddleware_1.requirePermission)('write', 'contract'), contractController_1.createContract);
app.get('/api/contracts', authMiddleware_1.authMiddleware, (0, authMiddleware_1.requireAppAccess)('planner'), (0, authMiddleware_1.requirePermission)('read', 'contract'), contractController_1.getAllContracts);
app.get('/api/patients/:patientId/contracts', authMiddleware_1.authMiddleware, (0, authMiddleware_1.requireAppAccess)('planner'), (0, authMiddleware_1.requirePermission)('read', 'contract'), contractController_1.getPatientContracts);
app.get('/api/contracts/:id', authMiddleware_1.authMiddleware, (0, authMiddleware_1.requireAppAccess)('planner'), (0, authMiddleware_1.requirePermission)('read', 'contract'), contractController_1.getContract);
app.delete('/api/contracts/:id', authMiddleware_1.authMiddleware, (0, authMiddleware_1.requireAppAccess)('planner'), (0, authMiddleware_1.requirePermission)('delete', 'contract'), contractController_1.deleteContract);
// Permission & Role Routes
const permissionController_1 = require("./controllers/permissionController");
const roleController_1 = require("./controllers/roleController");
app.get('/api/permissions', authMiddleware_1.authMiddleware, permissionController_1.getPermissions);
app.get('/api/roles', authMiddleware_1.authMiddleware, roleController_1.getRoles);
app.post('/api/roles', authMiddleware_1.authMiddleware, roleController_1.createRole);
app.put('/api/roles/:id', authMiddleware_1.authMiddleware, roleController_1.updateRole);
app.delete('/api/roles/:id', authMiddleware_1.authMiddleware, roleController_1.deleteRole);
// Clinic Routes
const clinicController_1 = require("./controllers/clinicController");
app.get('/api/clinics', authMiddleware_1.authMiddleware, clinicController_1.getClinics);
app.post('/api/clinics', authMiddleware_1.authMiddleware, clinicController_1.createClinic);
app.put('/api/clinics/:id', authMiddleware_1.authMiddleware, clinicController_1.updateClinic);
app.delete('/api/clinics/:id', authMiddleware_1.authMiddleware, clinicController_1.deleteClinic);
// User Management Routes
const userController_1 = require("./controllers/userController");
app.get('/api/users', authMiddleware_1.authMiddleware, userController_1.getUsers);
app.post('/api/users', authMiddleware_1.authMiddleware, userController_1.createUser);
app.put('/api/users/:id', authMiddleware_1.authMiddleware, userController_1.updateUser);
app.delete('/api/users/:id', authMiddleware_1.authMiddleware, userController_1.deleteUser);
// Start Server
app.listen(PORT, async () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    try {
        await prisma_1.default.$connect();
        console.log('✅ Database connected successfully');
    }
    catch (error) {
        console.error('❌ Database connection failed', error);
    }
});
