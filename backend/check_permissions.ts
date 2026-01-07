import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const count = await prisma.permission.count();
        console.log(`Permission count: ${count}`);
        const permissions = await prisma.permission.findMany({ take: 5 });
        console.log('Sample permissions:', permissions);

        const roles = await prisma.role.count();
        console.log(`Role count: ${roles}`);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
