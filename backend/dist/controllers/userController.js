"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.updateUser = exports.createUser = exports.getUsers = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const getUsers = async (req, res) => {
    try {
        const users = await prisma_1.default.user.findMany({
            include: {
                tenant: true,
                appAccess: {
                    include: { role: true, application: true }
                },
                userClinics: {
                    include: { clinic: true }
                }
            }
        });
        // Sanitize passwords
        const sanitized = users.map(u => {
            const { password, ...rest } = u;
            // Get planner role if exists
            const plannerAccess = u.appAccess.find(a => a.application.name === 'planner');
            return {
                ...rest,
                roleId: plannerAccess?.roleId,
                // Flatten clinic list for easier frontend use
                clinics: u.userClinics.map(uc => uc.clinic)
            };
        });
        res.json(sanitized);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};
exports.getUsers = getUsers;
const createUser = async (req, res) => {
    try {
        const { name, email, password, tenantId, isSuperAdmin, clinicIds, roleId } = req.body;
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const user = await prisma_1.default.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                tenantId,
                isSuperAdmin: isSuperAdmin || false,
                // Create UserClinic records if clinicIds provided
                userClinics: clinicIds?.length ? {
                    create: clinicIds.map((clinicId) => ({ clinicId }))
                } : undefined
            },
            include: {
                userClinics: { include: { clinic: true } }
            }
        });
        // If roleId provided, assign to planner app
        if (roleId) {
            const plannerApp = await prisma_1.default.application.findUnique({ where: { name: 'planner' } });
            if (plannerApp) {
                await prisma_1.default.userAppAccess.create({
                    data: {
                        userId: user.id,
                        applicationId: plannerApp.id,
                        roleId: roleId
                    }
                });
            }
        }
        const { password: _, ...userWithoutPassword } = user;
        res.json({
            ...userWithoutPassword,
            clinics: user.userClinics.map(uc => uc.clinic)
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create user' });
    }
};
exports.createUser = createUser;
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, isSuperAdmin, clinicIds, roleId } = req.body;
        // Update user basic info
        const user = await prisma_1.default.user.update({
            where: { id },
            data: {
                name,
                email,
                isSuperAdmin
            }
        });
        // If roleId provided, sync UserAppAccess for planner app
        if (roleId !== undefined) {
            const plannerApp = await prisma_1.default.application.findUnique({ where: { name: 'planner' } });
            if (plannerApp) {
                if (roleId) {
                    await prisma_1.default.userAppAccess.upsert({
                        where: {
                            userId_applicationId: {
                                userId: id,
                                applicationId: plannerApp.id
                            }
                        },
                        update: { roleId },
                        create: {
                            userId: id,
                            applicationId: plannerApp.id,
                            roleId
                        }
                    });
                }
                else {
                    // If roleId is null/empty, maybe we should remove access? 
                    // For now let's just delete it if it exists
                    await prisma_1.default.userAppAccess.deleteMany({
                        where: {
                            userId: id,
                            applicationId: plannerApp.id
                        }
                    });
                }
            }
        }
        // If clinicIds provided, sync UserClinic records
        if (clinicIds !== undefined) {
            // Delete all existing
            await prisma_1.default.userClinic.deleteMany({ where: { userId: id } });
            // Create new ones
            if (clinicIds.length > 0) {
                await prisma_1.default.userClinic.createMany({
                    data: clinicIds.map((clinicId) => ({ userId: id, clinicId }))
                });
            }
        }
        // Fetch updated user with clinics and app access
        const updated = await prisma_1.default.user.findUnique({
            where: { id },
            include: {
                userClinics: { include: { clinic: true } },
                appAccess: { include: { application: true } }
            }
        });
        if (!updated) {
            return res.status(404).json({ error: 'User not found' });
        }
        const { password: _, ...userWithoutPassword } = updated;
        const plannerAccess = updated.appAccess.find(a => a.application.name === 'planner');
        res.json({
            ...userWithoutPassword,
            roleId: plannerAccess?.roleId,
            clinics: updated.userClinics.map(uc => uc.clinic)
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update user' });
    }
};
exports.updateUser = updateUser;
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma_1.default.user.delete({ where: { id } });
        res.json({ message: 'User deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
};
exports.deleteUser = deleteUser;
