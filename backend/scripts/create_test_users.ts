import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

async function createTestUsers() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const prisma = app.get(PrismaService);

    const password = 'Password123!';
    const hashedPassword = await bcrypt.hash(password, 10);

    // 1. Get or Create Tenant
    let tenant = await prisma.tenant.findFirst({ where: { name: 'Frontend Test Tenant' } });
    if (!tenant) {
        tenant = await prisma.tenant.create({
            data: {
                name: 'Frontend Test Tenant',
                customerCode: '9999'
            }
        });
        console.log('Created new Tenant');
    }

    // 2. Create Tenant Admin (Restricted)
    const adminEmail = 'test-admin@example.com';
    const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!existingAdmin) {
        await prisma.user.create({
            data: {
                email: adminEmail,
                password: hashedPassword,
                name: 'Test Tenant Admin',
                role: Role.ADMIN,
                tenantId: tenant.id,
                status: 'ACTIVE'
            }
        });
        console.log(`✅ Created User: ${adminEmail} (Role: ADMIN)`);
    } else {
        console.log(`ℹ️ User ${adminEmail} already exists`);
    }

    // 3. Create Sales User (Allowed)
    const salesEmail = 'test-sales@example.com';
    const existingSales = await prisma.user.findUnique({ where: { email: salesEmail } });
    if (!existingSales) {
        await prisma.user.create({
            data: {
                email: salesEmail,
                password: hashedPassword,
                name: 'Test Sales User',
                role: Role.SALES,
                // Sales users usually don't need a specific tenant, or might be system-wide.
                // For this test, valid role is key.
                tenantId: tenant.id,
                status: 'ACTIVE'
            }
        });
        console.log(`✅ Created User: ${salesEmail} (Role: SALES)`);
    } else {
        console.log(`ℹ️ User ${salesEmail} already exists`);
    }

    console.log('\n--- Login Credentials ---');
    console.log(`Restricted User: ${adminEmail} / ${password}`);
    console.log(`Allowed User:    ${salesEmail} / ${password}`);

    await app.close();
}

createTestUsers();
