
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding CPQ Data...');

    // 1. Create a Seed Plan
    const plan = await prisma.plan.upsert({
        where: { id: 'plan_seed_123' },
        update: {},
        create: {
            id: 'plan_seed_123',
            name: 'Seed Plan',
            price: 29.99,
            billingCycle: 'MONTHLY',
            tier: 'STANDARD',
            freeMinutes: 1000,
            maxDIDs: 5,
            maxExtensions: 20
        }
    });
    console.log('Plan seeded:', plan.id);

    // 2. Create a Blueprint
    const blueprint = await prisma.pricingBlueprint.upsert({
        where: { id: 'bp_seed_001' },
        update: {},
        create: {
            id: 'bp_seed_001',
            name: 'Enterprise Voice',
            rules: {
                description: 'Flexible seat-based pricing',
                currency: 'USD',
                billing_frequency: 'monthly'
            },
            components: [
                {
                    id: 'comp_seat',
                    type: 'PER_EXTENSION',
                    name: 'Standard Seat',
                    unit_price: 15.00,
                    billing_cycle: 'monthly'
                },
                {
                    id: 'comp_did',
                    type: 'PER_DID',
                    name: 'Phone Number',
                    unit_price: 2.00,
                    billing_cycle: 'monthly'
                },
                {
                    id: 'comp_setup',
                    type: 'SETUP_FEE',
                    name: 'Account Setup',
                    unit_price: 99.00,
                    billing_cycle: 'one_time'
                }
            ]
        }
    });
    console.log('Blueprint seeded:', blueprint.id);

    // 3. Create Seed TFNs
    const tfns = ['+18005550201', '+18005550202', '+18005550203'];
    for (const num of tfns) {
        await prisma.tFN.upsert({
            where: { number: num },
            update: { status: 'AVAILABLE', heldBy: null, heldUntil: null },
            create: {
                number: num,
                status: 'AVAILABLE',
                price: 5.00
            }
        });
    }
    console.log('TFNs seeded:', tfns);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
