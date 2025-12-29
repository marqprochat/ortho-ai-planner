import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting seed...');

    // 1. Applications
    console.log('Upserting applications...');

    const portalApp = await prisma.application.upsert({
        where: { name: 'portal' },
        update: {},
        create: {
            name: 'portal',
            displayName: 'Portal Administrativo',
            description: 'Gestão centralizada de clínicas e usuários',
            icon: 'LayoutDashboard',
            url: 'http://localhost:5173'
        }
    });

    const plannerApp = await prisma.application.upsert({
        where: { name: 'planner' },
        update: {},
        create: {
            name: 'planner',
            displayName: 'Planejamento Ortodôntico',
            description: 'Planejamento de tratamento assistido por IA',
            icon: 'ClipboardList',
            url: 'http://localhost:5174'
        }
    });

    console.log(`✅ Applications ensured: ${portalApp.name}, ${plannerApp.name}`);

    // 2. Permissions
    console.log('Upserting permissions...');

    const permissions = [
        // --- Portal Permissions ---
        { action: 'manage', resource: 'user', description: 'Gerenciar usuários', appId: portalApp.id },
        { action: 'manage', resource: 'role', description: 'Gerenciar perfis e permissões', appId: portalApp.id },
        { action: 'read', resource: 'clinic', description: 'Visualizar dados da clínica', appId: portalApp.id }, // Generic, but fits portal view
        { action: 'manage', resource: 'clinic', description: 'Gerenciar configurações da clínica', appId: portalApp.id },

        // --- Planner Permissions ---
        { action: 'read', resource: 'patient', description: 'Visualizar pacientes', appId: plannerApp.id },
        { action: 'write', resource: 'patient', description: 'Criar e editar pacientes', appId: plannerApp.id },
        { action: 'delete', resource: 'patient', description: 'Excluir pacientes', appId: plannerApp.id },
        { action: 'manage', resource: 'patient', description: 'Gerenciar todos os pacientes da clínica', appId: plannerApp.id },

        { action: 'read', resource: 'planning', description: 'Visualizar planejamentos', appId: plannerApp.id },
        { action: 'write', resource: 'planning', description: 'Criar e editar planejamentos', appId: plannerApp.id },
        { action: 'delete', resource: 'planning', description: 'Excluir planejamentos', appId: plannerApp.id },
        { action: 'manage', resource: 'planning', description: 'Gerenciar todos os planejamentos da clínica', appId: plannerApp.id },

        { action: 'read', resource: 'contract', description: 'Visualizar contratos', appId: plannerApp.id },
        { action: 'write', resource: 'contract', description: 'Gerar contratos', appId: plannerApp.id },
        { action: 'delete', resource: 'contract', description: 'Excluir contratos', appId: plannerApp.id },
    ];

    for (const p of permissions) {
        await prisma.permission.upsert({
            where: {
                action_resource: {
                    action: p.action,
                    resource: p.resource
                }
            },
            update: {
                description: p.description,
                applicationId: p.appId
            },
            create: {
                action: p.action,
                resource: p.resource,
                description: p.description,
                applicationId: p.appId
            }
        });
    }

    console.log(`✅ ${permissions.length} permissions ensured.`);

    // 3. Promote first user to SuperAdmin if exists and none exists
    console.log('Checking for SuperAdmin...');
    const superAdmin = await prisma.user.findFirst({ where: { isSuperAdmin: true } });
    if (!superAdmin) {
        const firstUser = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
        if (firstUser) {
            console.log(`Promoting ${firstUser.email} to SuperAdmin...`);
            await prisma.user.update({
                where: { id: firstUser.id },
                data: { isSuperAdmin: true }
            });

            // Grant Admin role to this user for both apps
            const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
            if (adminRole) {
                const apps = await prisma.application.findMany();
                for (const app of apps) {
                    await prisma.userAppAccess.upsert({
                        where: {
                            userId_applicationId: {
                                userId: firstUser.id,
                                applicationId: app.id
                            }
                        },
                        update: { roleId: adminRole.id },
                        create: {
                            userId: firstUser.id,
                            applicationId: app.id,
                            roleId: adminRole.id
                        }
                    });
                }
            }
            console.log(`✅ ${firstUser.email} is now SuperAdmin with full access.`);
        } else {
            console.log('No users found to promote.');
        }
    } else {
        console.log(`SuperAdmin already exists: ${superAdmin.email}`);
    }

    console.log('🏁 Seed completed successfully.');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
