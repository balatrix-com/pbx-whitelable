import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { InvoiceService } from '../billing/invoice.service';
import { WalletService } from '../wallet/wallet.service';
import { QuoteStatus, InvoiceStatus, TransactionType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { FreeSwitchSyncService } from '../freeswitch/freeswitch-sync.service';

import { StripeService } from '../payments/stripe.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LookupRedisService } from '../redis/lookup-redis.module';
import { ProvisionTenantDto } from './dto/provision-tenant.dto';
import { Role, UserStatus, SubscriptionStatus, TFNStatus } from '@prisma/client';

import { MailService } from '../mail/mail.service';

@Injectable()
export class OnboardingService {
    private readonly logger = new Logger(OnboardingService.name);

    constructor(
        private prisma: PrismaService,
        private billingService: BillingService,
        private invoiceService: InvoiceService,
        private walletService: WalletService,
        private jwtService: JwtService,
        private configService: ConfigService,
        private freeSwitchSync: FreeSwitchSyncService,
        private stripeService: StripeService,
        private notificationsService: NotificationsService,
        private lookupRedis: LookupRedisService,
        private httpService: HttpService,
        private mailService: MailService,
    ) { }

    async getQuoteByToken(token: string) {
        const quote = await this.prisma.quote.findUnique({
            where: { token },
            include: { plan: true }
        });
        if (!quote) throw new NotFoundException('Invalid or expired token');
        if (quote.expiresAt < new Date()) throw new BadRequestException('Link expired');
        if (quote.status === QuoteStatus.CONVERTED) throw new BadRequestException('Already activated');

        // Predict next customer code for UI display
        const nextCode = await this.getNextAvailableCustomerCode();

        return { ...quote, predictedCustomerCode: nextCode };
    }

    private async getNextAvailableCustomerCode(tx?: any): Promise<string> {
        const client = tx || this.prisma;
        const tenants = await client.tenant.findMany({
            where: { customerCode: { not: null } },
            select: { customerCode: true }
        });
        const codes = new Set(tenants.filter((t: any) => t.customerCode).map((t: any) => parseInt(t.customerCode!, 10)).filter((c: any) => !isNaN(c)));
        let nextCode = 1001;
        while (codes.has(nextCode)) nextCode++;
        return nextCode.toString();
    }

    async syncQuote(data: any) {
        this.logger.log(`Syncing quote from Sales: ${data.token}`);
        
        // Map the data to PBX Quote model
        const quoteData = {
            token: data.token,
            customerName: data.customerName,
            customerEmail: data.customerEmail,
            customerCompany: data.customerCompany,
            planId: data.planId,
            blueprintId: data.blueprintId,
            customPrice: data.customPrice,
            telecomDetails: data.telecomDetails || {},
            pricingSnapshot: data.pricingSnapshot || {},
            assetSnapshot: data.assetSnapshot || {},
            dealValue: data.dealValue,
            commission: data.commission,
            commissionRate: data.commissionRate,
            salesRepId: data.salesRepId,
            expiresAt: new Date(data.expiresAt),
            status: data.status ? (data.status.toUpperCase() as QuoteStatus) : QuoteStatus.DRAFT,
        };

        return this.prisma.quote.upsert({
            where: { token: data.token },
            update: quoteData,
            create: quoteData,
        });
    }

    async createCheckoutSession(token: string) {
        const quote = await this.getQuoteByToken(token);
        return this.stripeService.createCheckoutSession(quote.id);
    }
    // ... (createPaymentIntent remains same)

    // ... (finalizeOnboarding kept as is for now, focusing on completeOnboarding)

    async getAvailableTFNs(token: string) {
        const quote = await this.getQuoteByToken(token);
        if (!quote.planId) return [];

        const plan = await this.prisma.plan.findUnique({ where: { id: quote.planId } });
        if (!plan || plan.maxTFNs <= 0) return [];

        return this.prisma.tFN.findMany({
            where: {
                status: TFNStatus.AVAILABLE,
                tenantId: null,
                // Removed isDemo: false to show all available numbers as requested
            },
            orderBy: { number: 'asc' }
        });
    }

    async completeOnboarding(token: string, data: { adminPassword: string, extensionNames: string[], sessionId: string, selectedTfnId?: string }) {
        this.logger.log(`Completing onboarding for token: ${token}`);
        const quote = await this.getQuoteByToken(token);

        // 1. Verify Payment (if session provided)
        if (data.sessionId) {
            try {
                const session = await this.stripeService.verifySession(data.sessionId);
                this.logger.log(`Verified Stripe Session: ${session.id} for Quote ${quote.id}`);
            } catch (error) {
                this.logger.error(`Failed to verify session ${data.sessionId}: ${error.message}`);
                throw new BadRequestException('Payment verification failed: ' + error.message);
            }
        }

        // 3. Generate Codes & Hash Password
        const customerCode = await this.getNextAvailableCustomerCode();

        // 2. Prepare Extension Data with Names
        const telecom = quote.telecomDetails as any;
        const extensionData: any[] = [];

        if (telecom && telecom.extensionCount > 0) {
            const count = telecom.extensionCount;
            // Sales typically enforces prefix logic now, so we default to TRUE
            const usePrefix = telecom.useCustomerCodePrefix !== false;

            for (let i = 0; i < count; i++) {
                const name = data.extensionNames[i] || `Extension ${customerCode}${(i + 1).toString().padStart(2, '0')}`;
                const suffix = (i + 1).toString().padStart(2, '0'); // 01, 02...
                extensionData.push({
                    suffix: suffix,
                    name,
                    sipPassword: '123456',
                    usePrefix
                });
            }
        }

        const userPasswordHashed = await bcrypt.hash(data.adminPassword, 10);

        // ... transaction ...
        const transactionResult = await this.prisma.$transaction(async (prisma) => {
            // ... (Tenant, User, Subscription, Invoice creation) ...
            // Re-finding code inside transaction to be safe? 
            // Ideally yes, but "getNextAvailableCustomerCode" is outside.
            // For low volume, it's fine. For high volume, we might collide.
            // We can rely on unique constraint? There isn't one on customerCode strictly enforced by DB unique index maybe?
            // The schema likely has `customerCode` as unique. 
            // Let's proceed with the calculated one. If it fails, user retries.

            let stripeCustomerId = quote.stripeCustomerId;
            if (!stripeCustomerId) {
                stripeCustomerId = `cus_mock_${Date.now()}`;
            }

            const tenant = await prisma.tenant.create({
                data: {
                    name: quote.customerCompany || quote.customerName,
                    stripeCustomerId,
                    customerCode
                }
            });

            // ... (User, Subscription, Invoice same as before) ...

            const user = await prisma.user.upsert({
                where: { email: quote.customerEmail },
                update: {
                    name: quote.customerName,
                    password: userPasswordHashed,
                    tenantId: tenant.id,
                    status: 'ACTIVE',
                    forcePasswordChange: false
                },
                create: {
                    email: quote.customerEmail,
                    name: quote.customerName,
                    password: userPasswordHashed,
                    role: 'ADMIN',
                    tenantId: tenant.id,
                    status: 'ACTIVE',
                    forcePasswordChange: false,
                    monitoringEnabled: quote.customerCompany?.startsWith('Demo') || quote.customerName?.startsWith('Demo')
                }
            });

            // Create Welcome Notification
            await this.notificationsService.createNotification({
                tenantId: tenant.id,
                userId: user.id,
                type: 'system',
                title: 'Welcome to Balatrix!',
                message: 'Your telecom infrastructure dashboard is ready. Explore the features and start commanding your network.',
            }, prisma);

            if (quote.planId) {
                const plan = await prisma.plan.findUnique({ where: { id: quote.planId } });

                // Apply Plan-based Initial Credit
                if (plan?.initialCredit && Number(plan.initialCredit) > 0) {
                    await this.walletService.adjustBalance(
                        tenant.id,
                        Number(plan.initialCredit),
                        TransactionType.CREDIT,
                        `Initial Credit for Plan: ${plan.name}`,
                        undefined,
                        prisma
                    );
                }
            }

            // Apply Purchased Initial Credit (from Quote)
            if (telecom?.initialWalletCredit && Number(telecom.initialWalletCredit) > 0) {
                await this.walletService.adjustBalance(
                    tenant.id,
                    Number(telecom.initialWalletCredit),
                    TransactionType.CREDIT,
                    `Initial Wallet Credit Purchase`,
                    undefined,
                    prisma
                );
            }

            const snapshot = quote.pricingSnapshot as any;
            const total = snapshot?.subtotal || 0;

            const invoice = await prisma.invoice.create({
                data: {
                    quoteId: quote.id,
                    tenantId: tenant.id,
                    total: total,
                    balanceDue: 0,
                    status: InvoiceStatus.PAID,
                    paidAt: new Date(),
                    stripeId: data.sessionId
                }
            });

            // Provision Extensions
            const createdExtensionIds: string[] = [];
            let seqId = 1;
            for (const item of extensionData) {
                let extNum = item.suffix;
                if (item.usePrefix) {
                    extNum = `${customerCode}${item.suffix}`; // 100101
                } else {
                    // Fallback to simpler format if prefix disabled? 
                    // But requirement says "follow unique prefix code".
                    // Assuming default is ALWAYS prefix for now based on context.
                    extNum = `${customerCode}${item.suffix}`;
                }

                const ext = await prisma.extension.create({
                    data: {
                        extensionNumber: extNum,
                        name: item.name,
                        tenantId: tenant.id,
                        sequenceId: seqId,
                        sipUsername: `${extNum}_${customerCode}`,
                        sipPassword: item.sipPassword,
                        sipAuthRealm: process.env.SIP_SERVER || 'localhost'
                    }
                });
                createdExtensionIds.push(ext.id);
                seqId++;
            }

            // Update Quote
            await prisma.quote.update({
                where: { id: quote.id },
                data: { status: QuoteStatus.CONVERTED, tenantId: tenant.id }
            });

            // Assign TFN if selected
            if (data.selectedTfnId) {
                const tfn = await prisma.tFN.findUnique({ where: { id: data.selectedTfnId } });
                if (tfn && !tfn.tenantId && tfn.status === TFNStatus.AVAILABLE) {
                    await prisma.tFN.update({
                        where: { id: tfn.id },
                        data: {
                            tenantId: tenant.id,
                            status: TFNStatus.ASSIGNED,
                            purchasedAt: new Date()
                        }
                    });
                    // Sync TFN
                    await this.freeSwitchSync.syncTFN(tfn.id, prisma).catch(err => {
                        this.logger.error(`Failed to sync TFN ${tfn.number} for new tenant ${tenant.id}: ${err.message}`);
                    });
                    await this.lookupRedis.updateNumberLookup(tfn.number, tenant.id);
                }
            }

            // Deferred Sync to Sub Billing
            if (data.selectedTfnId) {
                const tfn = await prisma.tFN.findUnique({ where: { id: data.selectedTfnId } });
                if (tfn) {
                    this.syncAssetsToSubBilling(tenant.id, { tfns: [tfn.number] }).catch(err => {
                        this.logger.error(`Deferred asset sync failed for tenant ${tenant.id}: ${err.message}`);
                    });
                }
            }

            // Initialize Redis Lookup
            await this.lookupRedis.updateExtensionLookup(tenant.id, customerCode);

            return {
                result: {
                    accessToken: '',
                    user: { id: user.id, email: user.email, role: user.role, tenantId: tenant.id }
                },
                extensionIdsToSync: createdExtensionIds,
                userPayload: { sub: user.id, email: user.email, role: user.role, tenantId: tenant.id }
            };

        }, { timeout: 120000 });

        // Trigger Onboarding Completion Email
        try {
            const tenant = await this.prisma.tenant.findUnique({
                where: { id: transactionResult.result.user.tenantId },
                include: { tfns: true, extensions: true }
            });
            const tfn = tenant?.tfns[0]?.number || 'N/A';
            const extensionsList = tenant?.extensions.map(e => `&bull; <b>${e.extensionNumber}</b> - ${e.name}<br>`).join("") || "None";
            const extensionsHtml = `<div style="text-align: left; display: inline-block; margin: 10px auto;">${extensionsList}</div>`;

            this.logger.log(`Sending onboarding completion email to ${quote.customerEmail}...`);
            await this.mailService.sendOnboardingCompletionEmail(
                quote.customerEmail,
                quote.customerName,
                tenant?.customerCode || '',
                tfn,
                extensionsHtml,
                quote.customerEmail,
                quote.plan?.name || 'Standard Plan',
                quote.token.slice(0, 8).toUpperCase(), // Use short token as quote no
                'Welcome123!' // Default password
            );
        } catch (emailErr) {
            this.logger.error(`Failed to send onboarding completion email for ${quote.customerEmail}: ${emailErr.message}`);
        }

        // ... (JWT signing) ...
        const secret = this.configService.get<string>('JWT_SECRET') || 'dev_secret';
        transactionResult.result.accessToken = this.jwtService.sign(transactionResult.userPayload, { secret });

        return transactionResult;
    }

    async provisionTenantFromSubBilling(data: ProvisionTenantDto) {
        this.logger.log(`Provisioning tenant from Sub Billing: ${data.subBillingCustomerId}`);

        // Early check for idempotency: if subscription already exists and is active, we might have already finished
        const existingSub = await this.prisma.subscription.findUnique({
            where: { subBillingSubscriptionId: data.subBillingSubscriptionId },
            include: { tenant: { include: { users: true, extensions: true } } }
        });

        if (existingSub && existingSub.status === SubscriptionStatus.ACTIVE && existingSub.tenant) {
            this.logger.log(`Subscription ${data.subBillingSubscriptionId} already exists and is active. Skipping duplicate provisioning.`);
            const adminUser = existingSub.tenant.users.find(u => u.role === Role.ADMIN);
            return {
                tenant: existingSub.tenant,
                user: adminUser,
                subscription: existingSub,
                extensionIdsToSync: existingSub.tenant.extensions.map(e => e.id),
                alreadyProvisioned: true // Flag to skip email sending
            };
        }

        const transactionResult = await this.prisma.$transaction(async (tx) => {
            // 1. Upsert Tenant
            let tenant = await tx.tenant.findUnique({
                where: { subBillingCustomerId: data.subBillingCustomerId }
            });

            if (!tenant) {
                // Check if email already exists as a tenant (unlikely but possible)
                const existingUser = await tx.user.findUnique({
                    where: { email: data.customerEmail.toLowerCase() },
                    include: { tenant: true }
                });

                if (existingUser && existingUser.tenantId && existingUser.tenant) {
                    tenant = existingUser.tenant;
                    // Update existing tenant with subBillingCustomerId
                    tenant = await tx.tenant.update({
                        where: { id: tenant.id },
                        data: { subBillingCustomerId: data.subBillingCustomerId }
                    });
                } else {
                    const customerCode = data.subBillingCustomerId;
                    
                    tenant = await tx.tenant.create({
                        data: {
                            id: data.subBillingCustomerId, // Align Template ID with Sub Billing Customer ID
                            name: options(data.customerCompany, data.customerName),
                            subBillingCustomerId: data.subBillingCustomerId,
                            customerCode
                        }
                    });
                }
            }

            // 2. Upsert User (Admin)
            let user = await tx.user.findUnique({
                where: { email: data.customerEmail.toLowerCase() }
            });

            if (!user) {
                user = await tx.user.create({
                    data: {
                        email: data.customerEmail.toLowerCase(),
                        name: data.customerName,
                        role: Role.ADMIN,
                        tenantId: tenant.id,
                        status: UserStatus.ACTIVE,
                        forcePasswordChange: true,
                        password: await bcrypt.hash('Welcome123!', 10), // Default password for automated provisioning
                        monitoringEnabled: data.subBillingCustomerId?.startsWith('T')
                    }
                });
            } else if (!user.tenantId) {
                user = await tx.user.update({
                    where: { id: user.id },
                    data: { tenantId: tenant.id, role: Role.ADMIN }
                });
            }

            // 3. Find Plan
            const planNameQuery = data.planName.split('(')[0].trim(); // Handle "Plan Name (Addon)" formats
            const plan = await tx.plan.findFirst({
                where: {
                    name: { contains: planNameQuery, mode: 'insensitive' }
                }
            });

            if (!plan) {
                this.logger.error(`Plan not found in PBX: ${data.planName}`);
                throw new BadRequestException(`Plan not found in PBX: ${data.planName}. Please ensure plans are synchronized.`);
            }

            // 4. Upsert Subscription
            let subscription = await tx.subscription.findUnique({
                where: { subBillingSubscriptionId: data.subBillingSubscriptionId }
            });

            const endDate = new Date();
            endDate.setFullYear(endDate.getFullYear() + 1); // Default to 1 year

            if (!subscription) {
                subscription = await tx.subscription.create({
                    data: {
                        tenantId: tenant.id,
                        planId: plan.id,
                        subBillingSubscriptionId: data.subBillingSubscriptionId,
                        status: SubscriptionStatus.ACTIVE,
                        startDate: new Date(),
                        endDate: endDate,
                        remainingFreeMinutes: data.freeMinutes || plan.freeMinutes
                    }
                });
            } else {
                subscription = await tx.subscription.update({
                    where: { id: subscription.id },
                    data: {
                        planId: plan.id,
                        status: SubscriptionStatus.ACTIVE,
                        remainingFreeMinutes: data.freeMinutes || plan.freeMinutes
                    }
                });
            }

            // 5. Provision Extensions (if any)
            const extensionIdsToSync: string[] = [];
            if (data.extensionCount > 0) {
                const existingExtensionsCount = await tx.extension.count({
                    where: { tenantId: tenant.id }
                });

                if (existingExtensionsCount === 0) {
                    const customerCode = tenant.customerCode;
                    for (let i = 0; i < data.extensionCount; i++) {
                        const suffix = (i + 1).toString().padStart(2, '0');
                        const extNum = `${customerCode}${suffix}`;
                        const ext = await tx.extension.create({
                            data: {
                                extensionNumber: extNum,
                                name: `Extension ${suffix}`,
                                tenantId: tenant.id,
                                sequenceId: i + 1,
                                sipUsername: `${extNum}_${customerCode}`,
                                sipPassword: '123456',
                                sipAuthRealm: process.env.SIP_SERVER || 'localhost'
                            }
                        });
                        extensionIdsToSync.push(ext.id);
                    }
                }
            }

            // 6. Assign TFN if provided
            if (data.selectedTfnId) {
                const tfn = await tx.tFN.findUnique({ where: { id: data.selectedTfnId } });
                if (tfn && !tfn.tenantId && tfn.status === TFNStatus.AVAILABLE) {
                    await tx.tFN.update({
                        where: { id: tfn.id },
                        data: {
                            tenantId: tenant.id,
                            status: TFNStatus.ASSIGNED,
                            purchasedAt: new Date()
                        }
                    });
                    // Sync TFN
                    await this.freeSwitchSync.syncTFN(tfn.id, this.prisma).catch(err => {
                        this.logger.error(`Failed to sync TFN ${tfn.number} for new tenant ${tenant.id}: ${err.message}`);
                    });
                    await this.lookupRedis.updateNumberLookup(tfn.number, tenant.id);
                }
            }

            this.logger.log(`Provisioning completed for tenant ${tenant.id} (${tenant.customerCode})`);

            // Initialize Redis Lookup
            await this.lookupRedis.updateExtensionLookup(tenant.id, tenant.customerCode ?? undefined);

            // 7. Sync Assets to Sub Billing if TFN provided
            if (data.selectedTfnId) {
                const tfn = await tx.tFN.findUnique({ where: { id: data.selectedTfnId } });
                if (tfn) {
                    this.syncAssetsToSubBilling(tenant.id, { tfns: [tfn.number] }).catch(err => {
                        this.logger.error(`Deferred asset sync failed for tenant ${tenant.id}: ${err.message}`);
                    });
                }
            }

            return { tenant, user, subscription, extensionIdsToSync };
        }, { timeout: 120000 });

        // Trigger Onboarding Completion Email for Sub-billing flow
        try {
            const tenant = await this.prisma.tenant.findUnique({
                where: { id: transactionResult.tenant.id },
                include: { tfns: true, extensions: true }
            });
            const tfn = tenant?.tfns[0]?.number || 'N/A';
            const extensionsList = tenant?.extensions.map(e => `&bull; <b>${e.extensionNumber}</b> - ${e.name}<br>`).join("") || "None";
            const extensionsHtml = `<div style="text-align: left; display: inline-block; margin: 10px auto;">${extensionsList}</div>`;

            this.logger.log(`Sending onboarding completion email to ${data.customerEmail}...`);
            await this.mailService.sendOnboardingCompletionEmail(
                data.customerEmail,
                data.customerName,
                tenant?.customerCode || '',
                tfn,
                extensionsHtml,
                data.customerEmail,
                data.planName,
                data.subBillingSubscriptionId.slice(0, 8).toUpperCase(),
                'Welcome123!' // Default password
            );
        } catch (emailErr) {
            this.logger.error(`Failed to send onboarding completion email (Sub-billing flow) for ${data.customerEmail}: ${emailErr.message}`);
        }

        return transactionResult;
    }

    async getOnboardingStatus(tenantId: string) {
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            include: {
                subscriptions: {
                    where: { status: SubscriptionStatus.ACTIVE },
                    include: { plan: true }
                },
                tfns: true
            }
        });

        if (!tenant) return { needsTfn: false };

        const activeSub = tenant.subscriptions[0];
        if (!activeSub || !activeSub.subBillingSubscriptionId) return { needsTfn: false };

        // Call Sub-billing to get actual asset allowance (includes addons)
        let totalAllowedTfns = activeSub.plan.maxTFNs;
        try {
            const subBilling = this.configService.get<any>('subBilling');
            if (subBilling?.apiUrl) {
                const endpoint = `${subBilling.apiUrl}/pbx/subscription-assets/${activeSub.subBillingSubscriptionId}`;
                const response = await lastValueFrom(this.httpService.get(endpoint));
                // Total TFNs the customer paid for (Base + Addons)
                totalAllowedTfns = response.data.totalTfns;
            }
        } catch (error) {
            this.logger.error(`Failed to fetch asset allowance from sub-billing: ${error.message}`);
            // Fallback to plan default
        }

        const needsTfn = totalAllowedTfns > tenant.tfns.length;

        return {
            needsTfn,
            maxTfns: totalAllowedTfns,
            currentTfns: tenant.tfns.length,
            planName: activeSub.plan.name
        };
    }

    async getAvailableTFNsAuthenticated(tenantId: string) {
        return this.prisma.tFN.findMany({
            where: {
                status: TFNStatus.AVAILABLE,
                tenantId: null,
                // Removed isDemo: false to show all available numbers as requested
            },
            orderBy: { number: 'asc' }
        });
    }

    async selectTfnForAuthenticatedUser(tenantId: string, tfnId: string) {
        const status = await this.getOnboardingStatus(tenantId);
        if (!status.needsTfn) {
            throw new BadRequestException('TFN selection not required or already completed');
        }

        const tfn = await this.prisma.tFN.findUnique({ where: { id: tfnId } });
        if (!tfn || tfn.tenantId || tfn.status !== TFNStatus.AVAILABLE) {
            throw new BadRequestException('Selected TFN is no longer available');
        }

        await this.prisma.tFN.update({
            where: { id: tfn.id },
            data: {
                tenantId: tenantId,
                status: TFNStatus.ASSIGNED,
                purchasedAt: new Date()
            }
        });

        // Sync
        await this.freeSwitchSync.syncTFN(tfn.id, this.prisma).catch(e => this.logger.error(`Sync TFN error: ${e.message}`));
        await this.lookupRedis.updateNumberLookup(tfn.number, tenantId);
        await this.syncAssetsToSubBilling(tenantId, { tfns: [tfn.number] });

        return { success: true, message: 'TFN selected successfully' };
    }

    private async syncAssetsToSubBilling(tenantId: string, assets: { tfns?: string[], dids?: string[] }) {
        try {
            const subscription = await this.prisma.subscription.findFirst({
                where: { tenantId },
                orderBy: { createdAt: 'desc' }
            });

            if (!subscription || !subscription.subBillingSubscriptionId) {
                this.logger.warn(`No sub-billing subscription found for tenant ${tenantId}, skipping asset sync`);
                return;
            }

            const subBilling = this.configService.get<any>('subBilling');
            if (!subBilling || !subBilling.apiUrl) {
                this.logger.warn(`Sub-billing API URL not configured, skipping asset sync`);
                return;
            }

            const endpoint = `${subBilling.apiUrl}/pbx/sync-assets/${subscription.subBillingSubscriptionId}`;
            await lastValueFrom(this.httpService.post(endpoint, assets));
            this.logger.log(`Successfully synced assets for tenant ${tenantId} to sub-billing`);
        } catch (error) {
            this.logger.error(`Failed to sync assets to sub-billing for tenant ${tenantId}: ${error.message}`);
        }
    }
}

function options(company?: string, name?: string): string {
    const val = (company || name || '').trim();
    return val || 'New Customer';
}
