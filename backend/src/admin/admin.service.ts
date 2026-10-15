import { Injectable, Logger, HttpException, HttpStatus, NotFoundException, ConflictException, BadGatewayException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { FreeSwitchSyncService } from '../freeswitch/freeswitch-sync.service';
import { LookupRedisService } from '../redis/lookup-redis.module';
import { EntitlementsService } from '../entitlements/entitlements.service';

@Injectable()
export class AdminService {
    private readonly logger = new Logger(AdminService.name);

    constructor(
        private prisma: PrismaService,
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        private readonly freeswitchSync: FreeSwitchSyncService,
        private readonly lookupRedis: LookupRedisService,
        private readonly entitlements: EntitlementsService,
    ) { }

    private get subBillingUrl() {
        return this.configService.get<string>('subBilling.apiUrl');
    }

    private get cacheRefreshUrl() {
        return this.configService.get<string>('billingCacheRefresh.url');
    }

    private get cacheRefreshToken() {
        return this.configService.get<string>('billingCacheRefresh.token');
    }

    /**
     * Trigger the billing system cache refresh API
     */
    async triggerCacheRefresh(): Promise<void> {
        if (!this.cacheRefreshUrl || !this.cacheRefreshToken) {
            this.logger.warn('Cache refresh config missing. Skipping trigger.');
            return;
        }

        try {
            await lastValueFrom(
                this.httpService.post(this.cacheRefreshUrl, {}, {
                    headers: { 'X-Auth-Token': this.cacheRefreshToken }
                })
            );
            this.logger.log('Billing system cache refresh triggered successfully.');
        } catch (error: any) {
            this.logger.error(`Failed to trigger billing cache refresh: ${error.message}`, error.response?.data);
        }
    }

    private handleProxyError(error: any, context: string) {
        const status = error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
        const message = error.response?.data?.message || error.message;
        this.logger.error(`[${context}] Billing proxy error: ${message}`, error.response?.data);
        throw new HttpException(message, status);
    }

    /**
     * Whitelabel Packages/Plans CRUD Proxy
     */
    async getAllPackages() {
        try {
            const response = await lastValueFrom(this.httpService.get(`${this.subBillingUrl}/plans`));
            return response.data;
        } catch (error: any) {
            this.handleProxyError(error, 'getAllPackages');
        }
    }

    async getPackage(id: string) {
        try {
            const response = await lastValueFrom(this.httpService.get(`${this.subBillingUrl}/plans/${id}`));
            return response.data;
        } catch (error: any) {
            this.handleProxyError(error, 'getPackage');
        }
    }

    async createPackage(data: any) {
        try {
            const response = await lastValueFrom(this.httpService.post(`${this.subBillingUrl}/plans`, data));
            if (response.data.success) {
                await this.triggerCacheRefresh();
            }
            return response.data;
        } catch (error: any) {
            this.handleProxyError(error, 'createPackage');
        }
    }

    async updatePackage(id: string, data: any) {
        try {
            const response = await lastValueFrom(this.httpService.put(`${this.subBillingUrl}/plans/${id}`, data));
            if (response.data.success) {
                await this.triggerCacheRefresh();
            }
            return response.data;
        } catch (error: any) {
            this.handleProxyError(error, 'updatePackage');
        }
    }

    async deletePackage(id: string) {
        try {
            const response = await lastValueFrom(this.httpService.delete(`${this.subBillingUrl}/plans/${id}`));
            if (response.data.success) {
                await this.triggerCacheRefresh();
            }
            return response.data;
        } catch (error: any) {
            this.handleProxyError(error, 'deletePackage');
        }
    }

    /**
     * Rate Cards CRUD Proxy
     */
    async getAllRateCards() {
        try {
            const response = await lastValueFrom(this.httpService.get(`${this.subBillingUrl}/rate-cards`));
            return response.data;
        } catch (error: any) {
            this.handleProxyError(error, 'getAllRateCards');
        }
    }

    async getRateCard(id: string) {
        try {
            const response = await lastValueFrom(this.httpService.get(`${this.subBillingUrl}/rate-cards/${id}`));
            return response.data;
        } catch (error: any) {
            this.handleProxyError(error, 'getRateCard');
        }
    }

    async createRateCard(data: any) {
        try {
            const response = await lastValueFrom(this.httpService.post(`${this.subBillingUrl}/rate-cards`, data));
            if (response.data.success) {
                await this.triggerCacheRefresh();
            }
            return response.data;
        } catch (error: any) {
            this.handleProxyError(error, 'createRateCard');
        }
    }

    async updateRateCard(id: string, data: any) {
        try {
            const response = await lastValueFrom(this.httpService.put(`${this.subBillingUrl}/rate-cards/${id}`, data));
            if (response.data.success) {
                await this.triggerCacheRefresh();
            }
            return response.data;
        } catch (error: any) {
            this.handleProxyError(error, 'updateRateCard');
        }
    }

    /**
     * Customer Rate Card Mappings Proxy
     */
    async getCustomerRateCardMappings() {
        try {
            const response = await lastValueFrom(this.httpService.get(`${this.subBillingUrl}/rate-cards/mappings`));
            return response.data;
        } catch (error: any) {
            this.handleProxyError(error, 'getCustomerRateCardMappings');
        }
    }

    /**
     * Fetch real-time wallet balances from billing system
     */
    async getRealTimeBalances() {
        try {
            const response = await lastValueFrom(this.httpService.get(`${this.subBillingUrl}/pbx/all`));
            return response.data || [];
        } catch (error: any) {
            this.logger.error(`Failed to fetch real-time balances: ${error.message}`);
            return [];
        }
    }

    async getBillingTotalBalance() {
        const balances = await this.getRealTimeBalances();
        return balances.reduce((sum: number, b: any) => sum + (parseFloat(b.balance) || 0), 0);
    }

    async updateCustomerRateCardMapping(data: { customer_id: string; ratecard_id: number }) {
        try {
            const response = await lastValueFrom(this.httpService.post(`${this.subBillingUrl}/rate-cards/mappings`, data));
            if (response.data.success) {
                await this.triggerCacheRefresh();
            }
            return response.data;
        } catch (error: any) {
            this.handleProxyError(error, 'updateCustomerRateCardMapping');
        }
    }

    /**
     * Recording Rate Cards CRUD Proxy
     */
    async getAllRecRateCards() {
        try {
            const response = await lastValueFrom(this.httpService.get(`${this.subBillingUrl}/rec-rate-cards`));
            return response.data;
        } catch (error: any) {
            this.handleProxyError(error, 'getAllRecRateCards');
        }
    }

    async getCustomerRecRateCardMappings() {
        try {
            const response = await lastValueFrom(this.httpService.get(`${this.subBillingUrl}/rec-rate-cards/mappings`));
            return response.data;
        } catch (error: any) {
            this.handleProxyError(error, 'getCustomerRecRateCardMappings');
        }
    }

    async updateRecRateCard(id: string, data: any) {
        try {
            const response = await lastValueFrom(this.httpService.put(`${this.subBillingUrl}/rec-rate-cards/${id}`, data));
            return response.data;
        } catch (error: any) {
            this.handleProxyError(error, 'updateRecRateCard');
        }
    }

    async getCustomerRecRateCard(customerId: string) {
        try {
            const response = await lastValueFrom(this.httpService.get(`${this.subBillingUrl}/rec-rate-cards/customer/${customerId}`));
            return response.data;
        } catch (error: any) {
            this.handleProxyError(error, 'getCustomerRecRateCard');
        }
    }

    async updateCustomerRecRateCardMapping(customerId: string, data: { rec_rc_id: number }) {
        try {
            const response = await lastValueFrom(this.httpService.put(`${this.subBillingUrl}/rec-rate-cards/customer/${customerId}`, data));
            return response.data;
        } catch (error: any) {
            this.handleProxyError(error, 'updateCustomerRecRateCardMapping');
        }
    }

    /**
     * Existing stats methods...
     */
    async getPlatformStats() {
        // Get basic tenant stats
        const totalTenants = await this.prisma.tenant.count();
        const totalUsers = await this.prisma.user.count();



        // Get telecom stats
        const telecomStats = await this.getTelecomStats();

        // Get wallet stats (now from billing source of truth)
        const walletStats = await this.getWalletStats();

        return {
            tenants: {
                total: totalTenants,
            },
            users: {
                total: totalUsers,
            },
            telecom: telecomStats,
            wallet: walletStats,
        };
    }

    /**
     * Get aggregated telecom statistics across all tenants
     */
    async getTelecomStats() {
        const [
            totalDIDs,
            totalTFNs,
            totalExtensions,
            totalRingGroups,
            totalIVRs,
            totalSchedules,
        ] = await Promise.all([
            this.prisma.dID.count(),
            this.prisma.tFN.count(),
            this.prisma.extension.count(),
            this.prisma.ringGroup.count(),
            this.prisma.iVR.count(),
            this.prisma.operationalSchedule.count(),
        ]);

        // Get active tenants (tenants with at least one DID or TFN)
        const [tenantsWithDIDs, tenantsWithTFNs] = await Promise.all([
            this.prisma.dID.groupBy({
                by: ['tenantId'],
            }),
            this.prisma.tFN.groupBy({
                by: ['tenantId'],
                where: { tenantId: { not: null } }
            }),
        ]);

        const activeTenantIds = new Set([
            ...tenantsWithDIDs.map(t => t.tenantId).filter(Boolean),
            ...tenantsWithTFNs.map(t => t.tenantId).filter(Boolean),
        ]);
        const activeTenants = activeTenantIds.size;

        // Calculate monthly revenue from DIDs and assigned TFNs
        const [didsWithFees, tfnsWithFees] = await Promise.all([
            this.prisma.dID.findMany({
                select: { monthlyFee: true },
            }),
            this.prisma.tFN.findMany({
                where: { tenantId: { not: null } },
                select: { price: true },
            }),
        ]);

        const monthlyRevenue =
            didsWithFees.reduce(
                (sum, did) => sum + (did.monthlyFee ? parseFloat(did.monthlyFee.toString()) : 0),
                0,
            ) +
            tfnsWithFees.reduce(
                (sum, tfn) => sum + (tfn.price ? parseFloat(tfn.price.toString()) : 0),
                0,
            );

        const limitStr = process.env.SYSTEM_LIMIT_EXTENSIONS;
        const limit = limitStr ? parseInt(limitStr, 10) : 500;
        const availableExtensions = Math.max(0, limit - totalExtensions);

        return {
            totalDIDs,
            totalTFNs,
            totalExtensions,
            availableExtensions,
            limitExtensions: limit,
            totalRingGroups,
            totalIVRs,
            totalSchedules,
            activeTenants, // Tenants with telecom services
            monthlyRevenue: monthlyRevenue.toFixed(2),
        };
    }

    /**
     * Get wallet/billing statistics
     */
    async getWalletStats() {
        // Get total balance across all wallets from billing system (source of truth)
        const totalBalance = await this.getBillingTotalBalance();

        // Get transaction count from PBX (local)
        const totalTransactions = await this.prisma.walletTransaction.count();

        return {
            totalBalance: totalBalance.toFixed(2),
            totalTransactions,
        };
    }

    /**
     * Get tenant-specific telecom stats (for detailed view)
     */
    async getTenantTelecomStats(tenantId: string) {
        const [dids, tfns, extensions, ringGroups, ivrs, schedules] = await Promise.all([
            this.prisma.dID.count({ where: { tenantId } }),
            this.prisma.tFN.count({ where: { tenantId } }),
            this.prisma.extension.count({ where: { tenantId } }),
            this.prisma.ringGroup.count({ where: { tenantId } }),
            this.prisma.iVR.count({ where: { tenantId } }),
            this.prisma.operationalSchedule.count({ where: { tenantId } }),
        ]);

        // Calculate DID + TFN monthly fees for this tenant
        const [tenantDIDs, tenantTFNs] = await Promise.all([
            this.prisma.dID.findMany({
                where: { tenantId },
                select: { monthlyFee: true },
            }),
            this.prisma.tFN.findMany({
                where: { tenantId },
                select: { price: true },
            }),
        ]);

        const monthlyFee =
            tenantDIDs.reduce(
                (sum, did) => sum + (did.monthlyFee ? parseFloat(did.monthlyFee.toString()) : 0),
                0,
            ) +
            tenantTFNs.reduce(
                (sum, tfn) => sum + (tfn.price ? parseFloat(tfn.price.toString()) : 0),
                0,
            );

        return {
            dids,
            tfns,
            extensions,
            ringGroups,
            ivrs,
            schedules,
            monthlyFee: monthlyFee.toFixed(2),
        };
    }
    /**
     * Number Management (TFN & DID)
     */
    async getAllNumbers() {
        const [tfns, dids] = await Promise.all([
            this.prisma.tFN.findMany({
                include: { tenant: { select: { id: true, name: true, customerCode: true } } },
                orderBy: { createdAt: 'desc' }
            }),
            this.prisma.dID.findMany({
                include: { tenant: { select: { id: true, name: true, customerCode: true } } },
                orderBy: { createdAt: 'desc' }
            })
        ]);

        return {
            tfns: tfns.map(t => ({
                id: t.id,
                number: t.number,
                status: t.status,
                price: t.price,
                isDemo: t.isDemo,
                tenant: t.tenant,
                purchasedAt: t.purchasedAt,
                createdAt: t.createdAt
            })),
            dids: dids.map(d => ({
                id: d.id,
                number: d.number,
                provider: d.provider,
                monthlyFee: d.monthlyFee,
                isActive: d.isActive,
                tenant: d.tenant,
                createdAt: d.createdAt
            }))
        };
    }

    async addTFN(data: { number: string; price?: number; isDemo?: boolean }) {
        return this.prisma.tFN.create({
            data: {
                number: data.number,
                price: data.price || 2.00,
                status: 'AVAILABLE',
                isDemo: data.isDemo || false
            }
        });
    }

    async addDID(data: { number: string; monthlyFee?: number; provider?: string }) {
        return this.prisma.dID.create({
            data: {
                number: data.number,
                monthlyFee: data.monthlyFee || 2.00,
                provider: data.provider || 'telnyx',
                isActive: true
            }
        });
    }

    async addTFNBulk(data: { numbers: string[]; price?: number; isDemo?: boolean }) {
        const payload = data.numbers.map(num => ({
            number: num,
            price: data.price || 2.00,
            status: 'AVAILABLE' as any,
            isDemo: data.isDemo || false
        }));
        return this.prisma.tFN.createMany({
            data: payload,
            skipDuplicates: true
        });
    }

    async addDIDBulk(data: { numbers: string[]; monthlyFee?: number; provider?: string }) {
        const payload = data.numbers.map(num => ({
            number: num,
            monthlyFee: data.monthlyFee || 2.00,
            provider: data.provider || 'telnyx',
            isActive: true
        }));
        return this.prisma.dID.createMany({
            data: payload,
            skipDuplicates: true
        });
    }

    private async syncAssetsToSubBilling(tenantId: string, assets: { tfns?: string[], dids?: string[] }) {
        try {
            const subscription = await this.prisma.subscription.findFirst({
                where: { tenantId, status: 'ACTIVE' },
                orderBy: { createdAt: 'desc' }
            });

            const targetId = subscription?.subBillingSubscriptionId;
            if (!targetId) throw new BadGatewayException('Active billing subscription mapping missing');
            const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { subBillingCustomerId: true } });
            if (!tenant?.subBillingCustomerId) throw new BadGatewayException('Billing customer mapping missing');

            if (!this.subBillingUrl) {
                this.logger.warn(`Sub-billing API URL not configured, skipping asset sync`);
                throw new BadGatewayException('Sub-billing URL not configured');
            }

            const endpoint = `${this.subBillingUrl}/pbx/sync-assets/${targetId}`;
            await lastValueFrom(this.httpService.post(endpoint, assets, {
                headers: { 'x-pbx-customer-id': tenant.subBillingCustomerId },
            }));
            this.logger.log(`Successfully synced assets for tenant ${tenantId} to sub-billing`);
        } catch (error: any) {
            this.logger.error(`Failed to sync assets to sub-billing for tenant ${tenantId}: ${error.message}`);
            throw error;
        }
    }

    private async unassignAssetsInSubBilling(tenantId: string, assets: { tfns?: string[], dids?: string[] }) {
        try {
            if (!this.subBillingUrl) throw new BadGatewayException('Sub-billing URL not configured');
            const subscription = await this.prisma.subscription.findFirst({
                where: { tenantId, status: 'ACTIVE' },
                orderBy: { createdAt: 'desc' },
            });
            if (!subscription?.subBillingSubscriptionId) throw new BadGatewayException('Active billing subscription mapping missing');
            const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { subBillingCustomerId: true } });
            if (!tenant?.subBillingCustomerId) throw new BadGatewayException('Billing customer mapping missing');
            const endpoint = `${this.subBillingUrl}/pbx/unassign-assets`;
            await lastValueFrom(this.httpService.post(endpoint, {
                subscriptionId: subscription.subBillingSubscriptionId,
                ...assets,
            }, { headers: { 'x-pbx-customer-id': tenant.subBillingCustomerId } }));
            this.logger.log(`Successfully unassigned assets in sub-billing: ${JSON.stringify(assets)}`);
        } catch (error: any) {
            this.logger.error(`Failed to unassign assets in sub-billing: ${error.message}`);
            throw error;
        }
    }

    async assignNumber(type: 'TFN' | 'DID', idOrNumber: string, tenantId: string) {
        if (type === 'TFN') {
            const tfn = await this.prisma.tFN.findFirst({
                where: { OR: [{ id: idOrNumber }, { number: idOrNumber }] }
            });
            if (!tfn) throw new NotFoundException(`TFN ${idOrNumber} not found`);
            if (tfn.tenantId === tenantId) {
                await this.syncAssetsToSubBilling(tenantId, { tfns: [tfn.number] });
                await this.freeswitchSync.syncTFN(tfn.id);
                await this.lookupRedis.updateNumberLookup(tfn.number, tenantId);
                return tfn;
            }
            if (tfn.tenantId || tfn.status !== 'AVAILABLE') throw new ConflictException('TFN is not available');

            const updated = await this.entitlements.withAvailableSlot(tenantId, 'tfns', async tx => {
                const claim = await tx.tFN.updateMany({
                    where: { id: tfn.id, tenantId: null, status: 'AVAILABLE' },
                    data: { tenantId, status: 'ASSIGNED', purchasedAt: new Date() },
                });
                if (claim.count !== 1) throw new ConflictException('TFN is no longer available');
                return tx.tFN.findUniqueOrThrow({ where: { id: tfn.id } });
            });

            try {
                await this.syncAssetsToSubBilling(tenantId, { tfns: [updated.number] });
            } catch (error) {
                await this.prisma.tFN.updateMany({
                    where: { id: updated.id, tenantId, status: 'ASSIGNED' },
                    data: { tenantId: null, status: 'AVAILABLE', purchasedAt: null },
                });
                throw error;
            }
            await this.freeswitchSync.syncTFN(updated.id);
            await this.lookupRedis.updateNumberLookup(updated.number, tenantId);

            return updated;
        } else {
            const did = await this.prisma.dID.findFirst({
                where: { OR: [{ id: idOrNumber }, { number: idOrNumber }] }
            });
            if (!did) throw new NotFoundException(`DID ${idOrNumber} not found`);
            if (did.tenantId === tenantId) {
                await this.syncAssetsToSubBilling(tenantId, { dids: [did.number] });
                await this.lookupRedis.updateNumberLookup(did.number, tenantId);
                return did;
            }
            if (did.tenantId) throw new ConflictException('DID is not available');

            const updated = await this.entitlements.withAvailableSlot(tenantId, 'dids', async tx => {
                const claim = await tx.dID.updateMany({
                    where: { id: did.id, tenantId: null },
                    data: { tenantId },
                });
                if (claim.count !== 1) throw new ConflictException('DID is no longer available');
                return tx.dID.findUniqueOrThrow({ where: { id: did.id } });
            });

            try {
                await this.syncAssetsToSubBilling(tenantId, { dids: [updated.number] });
            } catch (error) {
                await this.prisma.dID.updateMany({ where: { id: updated.id, tenantId }, data: { tenantId: null } });
                throw error;
            }
            await this.lookupRedis.updateNumberLookup(updated.number, tenantId);

            return updated;
        }
    }

    async unassignNumber(type: 'TFN' | 'DID', idOrNumber: string) {
        if (type === 'TFN') {
            const tfn = await this.prisma.tFN.findFirst({
                where: { OR: [{ id: idOrNumber }, { number: idOrNumber }] },
                include: { tenant: true }
            });
            if (tfn) {
                if (!tfn.tenantId) throw new ConflictException('TFN has no billing owner');
                await this.unassignAssetsInSubBilling(tfn.tenantId, { tfns: [tfn.number] });
                const changed = await this.prisma.tFN.updateMany({
                    where: { id: tfn.id, tenantId: tfn.tenantId },
                    data: {
                        tenantId: null,
                        status: 'AVAILABLE',
                        purchasedAt: null,
                        routeType: null,
                        routeTargetId: null,
                        forwardEnabled: false,
                        forwardNumber: null
                    }
                });
                if (changed.count !== 1) {
                    await this.syncAssetsToSubBilling(tfn.tenantId, { tfns: [tfn.number] });
                    throw new ConflictException('TFN assignment changed during unassign');
                }
                await this.freeswitchSync.deleteTFN(tfn).catch(err => {
                    this.logger.error(`Failed to cleanup FreeSWITCH for TFN ${tfn.number}: ${err.message}`);
                });
                await this.lookupRedis.deleteNumberLookup(tfn.number);
                return this.prisma.tFN.findUniqueOrThrow({ where: { id: tfn.id } });
            }
            throw new NotFoundException(`TFN ${idOrNumber} not found`);
        } else {
            const did = await this.prisma.dID.findFirst({
                where: { OR: [{ id: idOrNumber }, { number: idOrNumber }] },
                include: { tenant: true }
            });
            if (did) {
                if (!did.tenantId) throw new ConflictException('DID has no billing owner');
                await this.unassignAssetsInSubBilling(did.tenantId, { dids: [did.number] });
                const changed = await this.prisma.dID.updateMany({
                    where: { id: did.id, tenantId: did.tenantId },
                    data: {
                        tenantId: null,
                        routeType: null,
                        routeTargetId: null,
                        forwardEnabled: false,
                        forwardNumber: null
                    }
                });
                if (changed.count !== 1) {
                    await this.syncAssetsToSubBilling(did.tenantId, { dids: [did.number] });
                    throw new ConflictException('DID assignment changed during unassign');
                }
                await this.freeswitchSync.deleteDID(did).catch(err => {
                    this.logger.error(`Failed to cleanup FreeSWITCH for DID ${did.number}: ${err.message}`);
                });
                await this.lookupRedis.deleteNumberLookup(did.number);
                return this.prisma.dID.findUniqueOrThrow({ where: { id: did.id } });
            }
            throw new NotFoundException(`DID ${idOrNumber} not found`);
        }
    }

    async deleteNumber(type: 'TFN' | 'DID', id: string) {
        if (type === 'TFN') {
            const tfn = await this.prisma.tFN.findUnique({ where: { id }, include: { tenant: true } });
            if (tfn) {
                await this.freeswitchSync.deleteTFN(tfn).catch(err => {
                    this.logger.error(`Failed to cleanup FreeSWITCH for TFN ${tfn.number} on delete: ${err.message}`);
                });
            }
            return this.prisma.tFN.delete({ where: { id } });
        } else {
            const did = await this.prisma.dID.findUnique({ where: { id }, include: { tenant: true } });
            if (did) {
                await this.freeswitchSync.deleteDID(did).catch(err => {
                    this.logger.error(`Failed to cleanup FreeSWITCH for DID ${did.number} on delete: ${err.message}`);
                });
            }
            return this.prisma.dID.delete({ where: { id } });
        }
    }

    /**
     * Get statistics and activity for the global support dashboard
     */
    async getSupportStats() {
        const [totalTenants, totalDIDs, recentLogs] = await Promise.all([
            this.prisma.tenant.count(),
            this.prisma.dID.count(),
            this.prisma.auditLog.findMany({
                take: 10,
                orderBy: { createdAt: 'desc' }
            })
        ]);

        // Simple health check
        let systemStatus = 'Healthy';
        try {
            await this.prisma.$queryRaw`SELECT 1`;
        } catch (e) {
            systemStatus = 'Issues Detected';
        }

        return {
            stats: [
                { label: 'Active Tenants', value: totalTenants.toString() },
                { label: 'Total Phone Numbers', value: totalDIDs.toString() },
                { label: 'System Status', value: systemStatus },
                { label: 'Platform Role', value: 'Support' }
            ],
            recentActivity: recentLogs.map(log => ({
                id: log.id,
                type: log.category,
                tenant: log.actorEmail || 'System',
                subject: log.action,
                time: this.formatRelativeTime(log.createdAt),
                status: this.mapCategoryToStatus(log.category)
            }))
        };
    }

    private formatRelativeTime(date: Date): string {
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return 'just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} mins ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
        return `${Math.floor(diffInSeconds / 86400)} days ago`;
    }

    private mapCategoryToStatus(category: string): string {
        switch (category) {
            case 'SYSTEM': return 'warning';
            case 'AUTH': return 'info';
            case 'BILLING': return 'success';
            default: return 'info';
        }
    }

    /**
     * White-label Branding Methods
     */
    async getCurrentBranding() {
        const partner = await this.prisma.partner.findFirst();
        if (!partner) {
            return {
                name: 'Cloud PBX',
                primaryColor: '#3d52a0',
                accentColor: '#ed8f55',
                supportEmail: 'support@telecom-platform.com',
                supportPhone: '+1-800-555-0199',
            };
        }
        return partner;
    }

    async updateCurrentBranding(data: any) {
        const partner = await this.prisma.partner.findFirst();
        const smtpPortVal = data.smtpPort !== undefined && data.smtpPort !== null && data.smtpPort !== '' ? Number(data.smtpPort) : null;
        if (partner) {
            return this.prisma.partner.update({
                where: { id: partner.id },
                data: {
                    domain: data.domain !== undefined ? data.domain : partner.domain,
                    name: data.name,
                    primaryColor: data.primaryColor,
                    accentColor: data.accentColor,
                    logoMain: data.logoMain,
                    logoSidebar: data.logoSidebar,
                    favicon: data.favicon,
                    supportEmail: data.supportEmail,
                    supportPhone: data.supportPhone,
                    smtpHost: data.smtpHost,
                    smtpPort: smtpPortVal,
                    smtpSecure: data.smtpSecure,
                    smtpUser: data.smtpUser,
                    smtpPass: data.smtpPass,
                    smtpFromName: data.smtpFromName,
                    smtpFromEmail: data.smtpFromEmail,
                }
            });
        } else {
            return this.prisma.partner.create({
                data: {
                    domain: 'global',
                    name: data.name || 'Cloud PBX',
                    primaryColor: data.primaryColor || '#3d52a0',
                    accentColor: data.accentColor || '#ed8f55',
                    logoMain: data.logoMain,
                    logoSidebar: data.logoSidebar,
                    favicon: data.favicon,
                    supportEmail: data.supportEmail || 'support@telecom-platform.com',
                    supportPhone: data.supportPhone || '+1-800-555-0199',
                    smtpHost: data.smtpHost,
                    smtpPort: smtpPortVal,
                    smtpSecure: data.smtpSecure,
                    smtpUser: data.smtpUser,
                    smtpPass: data.smtpPass,
                    smtpFromName: data.smtpFromName,
                    smtpFromEmail: data.smtpFromEmail,
                }
            });
        }
    }

    /**
     * Get all active registered extensions from Kamailio
     */
    async getAllActiveExtensionsStatus() {
        const kamailioHost = this.configService.get<string>('KAMAILIO_RPC_URL') || 'http://127.0.0.1:8080/rpc';

        try {
            const response = await lastValueFrom(
                this.httpService.post(kamailioHost, {
                    jsonrpc: "2.0",
                    method: "ul.dump",
                    id: 1
                })
            );

            const result = response.data?.result;
            if (!result || !result.Domains) {
                return { online_count: 0, extensions: [] };
            }

            const activeExtensions = [];

            for (const domainObj of result.Domains) {
                const aors = domainObj.Domain?.AoRs || [];
                for (const aorObj of aors) {
                    const info = aorObj.Info;
                    if (!info || !info.AoR) continue;

                    const sipUsername = info.AoR.split('@')[0];
                    // Extract customer code (e.g. U1003 from U100304). 
                    // Usually the first letter and 4 digits.
                    // Fallback to substring.
                    let customerCode = sipUsername.substring(0, 5).toUpperCase();
                    
                    const contacts = info.Contacts || [];
                    const devices = contacts.map((c: any) => ({
                        address: c.Contact?.Address,
                        expires_in: c.Contact?.Expires,
                        user_agent: c.Contact?.['User-Agent'],
                        received_from: c.Contact?.Received,
                        transport_socket: c.Contact?.Socket,
                        state: c.Contact?.State
                    }));

                    activeExtensions.push({
                        customerCode,
                        extension: sipUsername,
                        domain: info.AoR.split('@')[1],
                        aor: info.AoR,
                        devices
                    });
                }
            }

            return {
                online_count: activeExtensions.length,
                extensions: activeExtensions
            };
        } catch (error) {
            this.logger.error(`Failed to fetch global Kamailio extension status: ${error.message}`);
            return { online_count: 0, extensions: [] };
        }
    }
}
