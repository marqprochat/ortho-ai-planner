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

        { action: 'read', resource: 'planning', description: 'Visualizar planejamentos', appId: plannerApp.id },
        { action: 'write', resource: 'planning', description: 'Criar e editar planejamentos', appId: plannerApp.id },
        { action: 'delete', resource: 'planning', description: 'Excluir planejamentos', appId: plannerApp.id },

        { action: 'read', resource: 'contract', description: 'Visualizar contratos', appId: plannerApp.id },
        { action: 'write', resource: 'contract', description: 'Gerar contratos', appId: plannerApp.id },
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
