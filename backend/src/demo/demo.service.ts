import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { FreeSwitchSyncService } from '../freeswitch/freeswitch-sync.service';
import { FreeSwitchDBService } from '../freeswitch/freeswitch-db.service';
import { KamailioDBService } from '../freeswitch/kamailio-db.service';
import { CacheFlushService } from '../freeswitch/cache-flush.service';
import { LookupRedisService } from '../redis/lookup-redis.module';
import { TFNStatus, Role, UserStatus, SubscriptionStatus, TransactionType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class DemoService {
    private readonly logger = new Logger(DemoService.name);

    constructor(
        private prisma: PrismaService,
        private walletService: WalletService,
        private freeSwitchSync: FreeSwitchSyncService,
        private lookupRedis: LookupRedisService,
        private freeSwitchDb: FreeSwitchDBService,
        private kamailioDb: KamailioDBService,
        private cacheFlush: CacheFlushService,
    ) { }

    async provisionDemo(data: {
        customerCode: string;
        tfnNumber: string;
        email: string;
        name: string;
        planId?: string;
        freeMinutes?: number;
    }) {
        this.logger.log(`Provisioning Demo Account: ${data.customerCode} for ${data.email}`);

        const planId = data.planId || 'price_standard_monthly';
        const freeMinutes = data.freeMinutes || 35; // New Policy: 35 free mins only

        // Create/Ensure Customer exists in Sub-billing first
        // Done before local transaction to prevent holding locks during external HTTP request
        await this.walletService.createSubBillingCustomer(data.customerCode, data.email, data.name);

        return await this.prisma.$transaction(async (tx) => {
            // 1. Create/Reuse Tenant and Ensure it is Unblocked
            let tenant = await tx.tenant.findUnique({ where: { customerCode: data.customerCode } });
            if (tenant) {
                this.logger.warn(`Tenant with code ${data.customerCode} already exists. Resetting.`);
                await tx.tenant.update({
                    where: { id: tenant.id },
                    data: { 
                        serviceBlocked: false, 
                        name: `Demo - ${data.name}`,
                        subBillingCustomerId: data.customerCode
                    }
                });
                
                // Clear old TFNs and Users to avoid clutter
                await tx.user.deleteMany({ where: { tenantId: tenant.id, email: { not: data.email } } });
                await tx.tFN.updateMany({
                    where: { tenantId: tenant.id, number: { not: data.tfnNumber } },
                    data: { tenantId: null, status: TFNStatus.AVAILABLE }
                });
            } else {
                tenant = await tx.tenant.create({
                    data: {
                        id: data.customerCode, // Use T0001/T0002 as the primary key
                        name: `Demo - ${data.name}`,
                        customerCode: data.customerCode,
                        subBillingCustomerId: data.customerCode,
                        serviceBlocked: false
                    }
                });
            }

            // 2. Initialize Wallet if missing
            const wallet = await tx.wallet.findUnique({ where: { tenantId: tenant.id } });
            if (!wallet) {
                await tx.wallet.create({
                    data: {
                        tenantId: tenant.id,
                        balance: 0.00, // No initial demo credit as per new policy
                        currency: 'USD'
                    }
                });
            }

            // 3. Create/Update Admin User
            const hashedPassword = await bcrypt.hash('Demo123!', 10);
            await tx.user.upsert({
                where: { email: data.email },
                update: {
                    name: data.name,
                    password: hashedPassword,
                    tenantId: tenant.id,
                    status: UserStatus.ACTIVE,
                    role: Role.ADMIN,
                    forcePasswordChange: false
                },
                create: {
                    email: data.email,
                    name: data.name,
                    password: hashedPassword,
                    role: Role.ADMIN,
                    tenantId: tenant.id,
                    status: UserStatus.ACTIVE,
                    forcePasswordChange: false
                }
            });

            // 4. Create/Update Subscription
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 1);
            
            const existingSub = await tx.subscription.findFirst({
                where: { tenantId: tenant.id, status: SubscriptionStatus.ACTIVE }
            });

            if (existingSub) {
                await tx.subscription.update({
                    where: { id: existingSub.id },
                    data: {
                        planId: planId,
                        endDate: endDate,
                        remainingFreeMinutes: freeMinutes
                    }
                });
            } else {
                await tx.subscription.create({
                    data: {
                        tenantId: tenant.id,
                        planId: planId,
                        status: SubscriptionStatus.ACTIVE,
                        startDate: new Date(),
                        endDate: endDate,
                        remainingFreeMinutes: freeMinutes
                    }
                });
            }

            // 5. Provision 4 Extensions
            for (let i = 1; i <= 4; i++) {
                const suffix = i.toString().padStart(2, '0');
                const extNum = `${data.customerCode}${suffix}`;
                await tx.extension.upsert({
                    where: { 
                        tenantId_extensionNumber: {
                            tenantId: tenant.id,
                            extensionNumber: extNum
                        }
                    },
                    update: {
                        name: `Extension ${suffix}`,
                        sipUsername: extNum,
                        sipPassword: '123456',
                    },
                    create: {
                        extensionNumber: extNum,
                        name: `Extension ${suffix}`,
                        tenantId: tenant.id,
                        sequenceId: i,
                        sipUsername: extNum,
                        sipPassword: '123456',
                        sipAuthRealm: process.env.SIP_SERVER || 'localhost'
                    }
                });
            }

            // 6. Provision Monitoring Addon
            await tx.monitoringAddOn.upsert({
                where: { tenantId: tenant.id },
                update: { isActive: true },
                create: {
                    tenantId: tenant.id,
                    isActive: true,
                    price: 0 // Free for demo
                }
            });

            // 7. Assign Demo TFN
            const tfn = await tx.tFN.findUnique({ where: { number: data.tfnNumber } });
            if (!tfn) throw new BadRequestException(`TFN ${data.tfnNumber} not found`);
            
            await tx.tFN.update({
                where: { id: tfn.id },
                data: {
                    tenantId: tenant.id,
                    status: TFNStatus.ASSIGNED,
                    purchasedAt: new Date()
                }
            });

            // Sync TFN to FreeSwitch
            await this.freeSwitchSync.syncTFN(tfn.id, tx as any).catch(err => {
                this.logger.error(`Failed to sync TFN ${tfn.number}: ${err.message}`);
            });
            
            // Update Redis Lookups
            await this.lookupRedis.updateNumberLookup(tfn.number, tenant.id);
            await this.lookupRedis.updateExtensionLookup(tenant.id, data.customerCode);

            // 8. Create Audit Log
            await tx.auditLog.create({
                data: {
                    action: 'Demo Provisioned',
                    category: 'Demo',
                    actorType: 'System',
                    actorEmail: data.email,
                    metadata: { customerCode: data.customerCode, tfnNumber: data.tfnNumber }
                }
            });

            return { success: true, tenantId: tenant.id };
        }, { timeout: 30000 });
    }

    async stopDemo(customerCode: string) {
        this.logger.log(`Stopping Demo Account: ${customerCode}`);

        const tenant = await this.prisma.tenant.findUnique({
            where: { customerCode },
            include: { tfns: true, extensions: true }
        });

        if (!tenant) throw new BadRequestException(`Demo tenant ${customerCode} not found`);

        // 0. Purge from Kamailio and FreeSWITCH DBs before transaction
        for (const ext of tenant.extensions) {
            await this.kamailioDb.deleteSubscriber(ext.sipUsername);
        }
        await this.freeSwitchDb.deleteDialplansByCustomer(customerCode);
        await this.freeSwitchDb.deleteRoutesByCustomer(tenant.id);
        await this.cacheFlush.flushCustomer(customerCode);

        return await this.prisma.$transaction(async (tx) => {
            // 1. Unassign TFNs
            for (const tfn of tenant.tfns) {
                await tx.tFN.update({
                    where: { id: tfn.id },
                    data: {
                        tenantId: null,
                        status: TFNStatus.AVAILABLE,
                        purchasedAt: null
                    }
                });
                // Remove from Redis lookup
                await this.lookupRedis.deleteNumberLookup(tfn.number);
            }

            // 2. Deactivate Subscription
            await tx.subscription.updateMany({
                where: { tenantId: tenant.id, status: SubscriptionStatus.ACTIVE },
                data: { status: SubscriptionStatus.ARCHIVED }
            });

            // 3. Block Tenant Service
            await tx.tenant.update({
                where: { id: tenant.id },
                data: { serviceBlocked: true }
            });

            // 4. Remove Extensions from Lookup
            await this.lookupRedis.deletePrefixLookup(customerCode);

            // 5. Purge local configuration records (keep CDRs, AuditLogs, Users, Tenant, Wallet)
            await tx.dIDForward.deleteMany({ where: { tenantId: tenant.id } });
            await tx.operationalSchedule.deleteMany({ where: { tenantId: tenant.id } });
            await tx.iVR.deleteMany({ where: { tenantId: tenant.id } });
            await tx.ringGroup.deleteMany({ where: { tenantId: tenant.id } });
            await tx.extension.deleteMany({ where: { tenantId: tenant.id } });

            // 6. Create Audit Log
            await tx.auditLog.create({
                data: {
                    action: 'Demo Stopped and Purged',
                    category: 'Demo',
                    actorType: 'System',
                    metadata: { customerCode }
                }
            });

            return { success: true };
        });
    }

    async getStats() {
        const total = await this.prisma.tenant.count({
            where: { customerCode: { startsWith: 'T' } }
        });
        const active = await this.prisma.tenant.count({
            where: { customerCode: { startsWith: 'T' }, serviceBlocked: false }
        });
        const available = await this.prisma.tenant.count({
            where: { customerCode: { startsWith: 'T' }, serviceBlocked: true }
        });
        const assigned = await this.prisma.tenant.count({
            where: {
                customerCode: { startsWith: 'T' },
                subscriptions: { some: { status: SubscriptionStatus.ACTIVE } }
            }
        });

        return { total, active, available, assigned };
    }

    async getAccounts() {
        const chunkSize = 10;
        let allTenants: any[] = [];
        for (let i = 0; i < 10; i++) {
            const chunk = await this.prisma.tenant.findMany({
                where: { customerCode: { startsWith: 'T' } },
                select: {
                    customerCode: true,
                    serviceBlocked: true,
                    tfns: {
                        where: { status: TFNStatus.ASSIGNED },
                        select: { number: true }
                    },
                    subscriptions: {
                        where: { status: SubscriptionStatus.ACTIVE },
                        select: { id: true }
                    },
                    users: {
                        where: { role: Role.ADMIN },
                        select: { name: true, email: true }
                    }
                },
                orderBy: { customerCode: 'asc' },
                take: chunkSize,
                skip: i * chunkSize
            });
            allTenants = allTenants.concat(chunk);
            if (chunk.length < chunkSize) break;
        }

        return allTenants.map(t => ({
            id: t.customerCode,
            status: t.serviceBlocked ? 'AVAILABLE' : (t.subscriptions.length > 0 ? 'ACTIVE' : 'STOPPED'),
            customerName: t.users[0]?.name || null,
            customerEmail: t.users[0]?.email || null,
            assignedTfn: t.tfns[0]?.number || null,
            salesUser: { name: 'Balatrix Sales' } // Placeholder for now
        }));
    }

    async getAvailableNumbers() {
        const numbers = await this.prisma.tFN.findMany({
            where: { 
                tenantId: null, 
                status: TFNStatus.AVAILABLE,
                isDemo: true // Only return demo pool numbers
            },
            select: { number: true },
            orderBy: { number: 'asc' },
            take: 15
        });
        return numbers;
    }

    async getAllNumbers() {
        const numbers = await this.prisma.tFN.findMany({
            where: { isDemo: true },
            select: {
                number: true,
                status: true,
                tenant: {
                    select: { name: true, customerCode: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 30
        });
        return numbers;
    }

    async addNumber(number: string) {
        // Check if exists
        const existing = await this.prisma.tFN.findUnique({ where: { number } });
        if (existing) {
            // If it exists but isn't marked as demo, we might want to convert it or error
            // For safety, let's just mark it as demo if it's available
            if (existing.tenantId) throw new BadRequestException('Number is already assigned to a tenant');
            
            return await this.prisma.tFN.update({
                where: { id: existing.id },
                data: { isDemo: true, status: TFNStatus.AVAILABLE }
            });
        }

        return await this.prisma.tFN.create({
            data: {
                number,
                isDemo: true,
                status: TFNStatus.AVAILABLE,
                price: 2.00
            }
        });
    }

    async deleteNumber(number: string) {
        const tfn = await this.prisma.tFN.findUnique({ where: { number } });
        if (!tfn) throw new BadRequestException('Number not found');
        if (tfn.tenantId) throw new BadRequestException('Cannot delete an assigned number');
        
        // If it was just a demo number, we can either remove the demo flag or delete it
        // User said "where i can add/manage", so delete is appropriate
        return await this.prisma.tFN.delete({ where: { id: tfn.id } });
    }


    async getActivity() {
        const chunkSize = 5;
        let allLogs: any[] = [];
        for (let i = 0; i < 4; i++) {
            const chunk = await this.prisma.auditLog.findMany({
                where: { 
                    OR: [
                        { category: 'Demo' },
                        { action: { contains: 'Demo' } },
                        { action: { contains: 'T0' } }
                    ]
                },
                select: {
                    id: true,
                    action: true,
                    actorEmail: true,
                    metadata: true,
                    createdAt: true
                },
                orderBy: { createdAt: 'desc' },
                take: chunkSize,
                skip: i * chunkSize
            });
            allLogs = allLogs.concat(chunk);
            if (chunk.length < chunkSize) break;
        }

        return allLogs.map(l => {
            const metadata = l.metadata as any;
            return {
                id: l.id,
                demoAccountId: metadata?.customerCode || 'System',
                eventType: l.action,
                description: `${l.action} event triggered by ${l.actorEmail || 'System'}`,
                createdAt: l.createdAt
            };
        });
    }
}
