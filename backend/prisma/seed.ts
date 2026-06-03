import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
const prisma = new PrismaClient();

async function main() {
    console.log('Seeding data...');

    // 1. Seek Plans
    await prisma.plan.upsert({
        where: { id: 'price_basic_monthly' },
        update: {},
        create: {
            id: 'price_basic_monthly',
            name: 'Basic Plan',
            description: 'Starter plan for small businesses',
            stripePriceId: 'price_mock_basic',
            billingCycle: 'MONTHLY',
            tier: 'BASIC',
            price: 10.00,
            freeMinutes: 100,
            overagePrice: 0.15
        }
    });

    await prisma.plan.upsert({
        where: { id: 'price_standard_monthly' },
        update: {},
        create: {
            id: 'price_standard_monthly',
            name: 'Standard Plan',
            description: 'Growth plan',
            stripePriceId: 'price_mock_standard',
            billingCycle: 'MONTHLY',
            tier: 'STANDARD',
            price: 30.00,
            freeMinutes: 500,
            overagePrice: 0.10
        }
    });

    // 2. Seed TFNs
    const tfnCount = await prisma.tFN.count();
    if (tfnCount === 0) {
        await prisma.tFN.createMany({
            data: [
                { number: '+18005550100', price: 2.00 },
                { number: '+18005550101', price: 2.00 },
                { number: '+18005550102', price: 2.00 },
                { number: '+18005550103', price: 5.00 },
            ]
        });
        console.log('Seeded TFNs');
    }

    // 3. Seed Super Admin
    const superAdminEmail = 'superadmin@example.com';
    const existingAdmin = await prisma.user.findUnique({
        where: { email: superAdminEmail }
    });

    if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash('SuperAdmin123!', 10);
        await prisma.user.create({
            data: {
                email: superAdminEmail,
                password: hashedPassword,
                role: 'SUPER_ADMIN',
                status: 'ACTIVE',
                name: 'Super Admin'
            }
        });
        console.log('Seeded Super Admin user');
    }


    // 4. Seed Sales User
    const salesEmail = 'sales@example.com';
    const existingSales = await prisma.user.findUnique({
        where: { email: salesEmail }
    });

    if (!existingSales) {
        const hashedPassword = await bcrypt.hash('SalesUser123!', 10);
        await prisma.user.create({
            data: {
                email: salesEmail,
                password: hashedPassword,
                role: 'SALES',
                status: 'ACTIVE',
                name: 'Sales User'
            }
        });
        console.log('Seeded Sales user');
    }

    console.log('Seeding complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
