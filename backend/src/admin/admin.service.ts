import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { FreeSwitchSyncService } from '../freeswitch/freeswitch-sync.service';

@Injectable()
export class AdminService {
    private readonly logger = new Logger(AdminService.name);

    constructor(
        private prisma: PrismaService,
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        private readonly freeswitchSync: FreeSwitchSyncService,
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
            totalExtensions,
            totalRingGroups,
            totalIVRs,
            totalSchedules,
        ] = await Promise.all([
            this.prisma.dID.count(),
            this.prisma.extension.count(),
            this.prisma.ringGroup.count(),
            this.prisma.iVR.count(),
            this.prisma.operationalSchedule.count(),
        ]);

        // Get active tenants (tenants with at least one DID)
        const tenantsWithDIDs = await this.prisma.dID.groupBy({
            by: ['tenantId'],
        });
        const activeTenants = tenantsWithDIDs.length;

        // Calculate monthly revenue from DIDs
        const didsWithFees = await this.prisma.dID.findMany({
            select: { monthlyFee: true },
        });
        const monthlyRevenue = didsWithFees.reduce(
            (sum, did) => sum + (did.monthlyFee ? parseFloat(did.monthlyFee.toString()) : 0),
            0,
        );

        return {
            totalDIDs,
            totalExtensions,
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
        const [dids, extensions, ringGroups, ivrs, schedules] = await Promise.all([
            this.prisma.dID.count({ where: { tenantId } }),
            this.prisma.extension.count({ where: { tenantId } }),
            this.prisma.ringGroup.count({ where: { tenantId } }),
            this.prisma.iVR.count({ where: { tenantId } }),
            this.prisma.operationalSchedule.count({ where: { tenantId } }),
        ]);

        // Calculate DID monthly fees for this tenant
        const tenantDIDs = await this.prisma.dID.findMany({
            where: { tenantId },
            select: { monthlyFee: true },
        });

        const monthlyFee = tenantDIDs.reduce(
            (sum, did) => sum + (did.monthlyFee ? parseFloat(did.monthlyFee.toString()) : 0),
            0,
        );

        return {
            dids,
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

    async assignNumber(type: 'TFN' | 'DID', id: string, tenantId: string) {
        if (type === 'TFN') {
            return this.prisma.tFN.update({
                where: { id },
                data: {
                    tenantId,
                    status: 'ASSIGNED',
                    purchasedAt: new Date()
                }
            });
        } else {
            return this.prisma.dID.update({
                where: { id },
                data: { tenantId }
            });
        }
    }

    async unassignNumber(type: 'TFN' | 'DID', id: string) {
        if (type === 'TFN') {
            const tfn = await this.prisma.tFN.findUnique({ where: { id }, include: { tenant: true } });
            if (tfn) {
                // Cleanup routing in FreeSWITCH
                await this.freeswitchSync.deleteTFN(tfn).catch(err => {
                    this.logger.error(`Failed to cleanup FreeSWITCH for TFN ${tfn.number}: ${err.message}`);
                });

                return this.prisma.tFN.update({
                    where: { id },
                    data: {
                        tenantId: null,
                        status: 'AVAILABLE',
                        routeType: null,
                        routeTargetId: null,
                        forwardEnabled: false,
                        forwardNumber: null
                    }
                });
            }
        } else {
            const did = await this.prisma.dID.findUnique({ where: { id }, include: { tenant: true } });
            if (did) {
                // Cleanup routing in FreeSWITCH
                await this.freeswitchSync.deleteDID(did).catch(err => {
                    this.logger.error(`Failed to cleanup FreeSWITCH for DID ${did.number}: ${err.message}`);
                });
            }

            return this.prisma.dID.update({
                where: { id },
                data: {
                    tenantId: null,
                    routeType: null,
                    routeTargetId: null,
                    forwardEnabled: false,
                    forwardNumber: null
                }
            });
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
        if (partner) {
            return this.prisma.partner.update({
                where: { id: partner.id },
                data: {
                    name: data.name,
                    primaryColor: data.primaryColor,
                    accentColor: data.accentColor,
                    logoMain: data.logoMain,
                    logoSidebar: data.logoSidebar,
                    favicon: data.favicon,
                    supportEmail: data.supportEmail,
                    supportPhone: data.supportPhone,
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
                }
            });
        }
    }
}
