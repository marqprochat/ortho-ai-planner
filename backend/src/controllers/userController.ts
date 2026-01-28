import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';

export const getUsers = async (req: Request, res: Response) => {
    try {
        const users = await prisma.user.findMany({
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
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

export const createUser = async (req: Request, res: Response) => {
    try {
        const { name, email, password, tenantId, isSuperAdmin, clinicIds, roleId, nickname } = req.body;

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                tenantId,
                isSuperAdmin: isSuperAdmin || false,
                nickname, // Add nickname
                // Create UserClinic records if clinicIds provided
                userClinics: clinicIds?.length ? {
                    create: clinicIds.map((clinicId: string) => ({ clinicId }))
                } : undefined
            },
            include: {
                userClinics: { include: { clinic: true } }
            }
        });

        // If roleId provided, assign to planner app
        if (roleId) {
            const plannerApp = await prisma.application.findUnique({ where: { name: 'planner' } });
            if (plannerApp) {
                await prisma.userAppAccess.create({
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
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create user' });
    }
};

export const updateUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, email, isSuperAdmin, clinicIds, roleId, nickname } = req.body;

        // Update user basic info
        const user = await prisma.user.update({
            where: { id },
            data: {
                name,
                email,
                isSuperAdmin,
                nickname // Add nickname
            }
        });

        // If roleId provided, sync UserAppAccess for planner app
        if (roleId !== undefined) {
            const plannerApp = await prisma.application.findUnique({ where: { name: 'planner' } });
            if (plannerApp) {
                if (roleId) {
                    await prisma.userAppAccess.upsert({
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
                } else {
                    // If roleId is null/empty, maybe we should remove access? 
                    // For now let's just delete it if it exists
                    await prisma.userAppAccess.deleteMany({
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
            await prisma.userClinic.deleteMany({ where: { userId: id } });
            // Create new ones
            if (clinicIds.length > 0) {
                await prisma.userClinic.createMany({
                    data: clinicIds.map((clinicId: string) => ({ userId: id, clinicId }))
                });
            }
        }

        // Fetch updated user with clinics and app access
        const updated = await prisma.user.findUnique({
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
    } catch (error) {
        res.status(500).json({ error: 'Failed to update user' });
    }
};

export const deleteUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.user.delete({ where: { id } });
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
};
