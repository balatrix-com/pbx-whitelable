import { Injectable, NotFoundException, BadRequestException, BadGatewayException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { Role } from '@prisma/client';
import { resolveTenantScope, TenantPrincipal } from '../auth/tenant-scope';

interface BillingSubscription {
    id: string;
    subscription_id: string;
    customer_id: string;
}

export interface BillingAddon {
    id: string;
    subscription_id: string;
    [key: string]: unknown;
}

export interface AddonCatalogItem {
    addon_id: string;
    name: string;
    resource_type: string;
    units_count?: number;
    unit_price: number;
    price: number;
    currency: string;
    is_active: boolean;
    description: string;
}

@Injectable()
export class AddonsService {
    private readonly logger = new Logger(AddonsService.name);
    private subBillingUrl: string;

    private readonly catalog: AddonCatalogItem[] = [
        {
            addon_id: 'addon_ext_1',
            name: '1 Extra Extension',
            resource_type: 'extension',
            units_count: 1,
            unit_price: 5.00,
            price: 5.00,
            currency: 'USD',
            is_active: true,
            description: 'Add 1 extra SIP extension with full PBX routing'
        },
        {
            addon_id: 'addon_tfn_1',
            name: '1 Extra Toll-Free Number (TFN)',
            resource_type: 'tfn',
            units_count: 1,
            unit_price: 5.00,
            price: 5.00,
            currency: 'USD',
            is_active: true,
            description: 'Reserve 1 additional Toll-Free phone number'
        },
        {
            addon_id: 'addon_did_1',
            name: '1 Direct Inward Dialing (DID)',
            resource_type: 'did',
            units_count: 1,
            unit_price: 3.00,
            price: 3.00,
            currency: 'USD',
            is_active: true,
            description: 'Dedicated local phone number for direct inward calls'
        },
        {
            addon_id: 'addon_recording_100gb',
            name: '100 GB Call Recording Storage',
            resource_type: 'storage',
            units_count: 1,
            unit_price: 20.00,
            price: 20.00,
            currency: 'USD',
            is_active: true,
            description: 'Secure cloud storage for call recordings and voicemail'
        },
        {
            addon_id: 'addon_monitoring_user',
            name: 'Call Monitoring User Seat',
            resource_type: 'mon',
            units_count: 1,
            unit_price: 15.00,
            price: 15.00,
            currency: 'USD',
            is_active: true,
            description: 'Real-time eavesdrop, whisper coaching, and supervisor barge'
        }
    ];

    constructor(
        private prisma: PrismaService,
        private walletService: WalletService,
        private httpService: HttpService,
        private configService: ConfigService
    ) {
        this.subBillingUrl = this.configService.get<string>('SUB_BILLING_API_URL') || 'http://localhost:5005/api';
    }

    async getCatalog(): Promise<AddonCatalogItem[]> {
        try {
            this.logger.log(`Fetching addon catalog from sub-billing: ${this.subBillingUrl}/addons/catalog`);
            const response = await firstValueFrom(
                this.httpService.get(`${this.subBillingUrl}/addons/catalog`)
            );
            const data = response.data?.data || response.data;
            if (Array.isArray(data) && data.length > 0) {
                return data.map(item => ({
                    addon_id: item.addon_id,
                    name: item.name,
                    resource_type: item.resource_type,
                    units_count: Number(item.units_count || 1),
                    unit_price: Number(item.unit_price),
                    price: Number(item.unit_price),
                    currency: item.currency,
                    is_active: item.is_active,
                    description: item.description || `${item.name} Add-on`
                }));
            }
        } catch (error) {
            this.logger.warn(`Failed to fetch addon catalog from sub-billing: ${error.message}, falling back to hardcoded catalog`);
        }
        return this.catalog.filter(item => item.is_active);
    }

    async createCatalogItem(data: any) {
        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.subBillingUrl}/addons/catalog`, data)
            );
            return response.data;
        } catch (error) {
            const status = error.response?.status || 500;
            const message = error.response?.data?.message || error.message;
            throw new BadRequestException(`Failed to create catalog item: ${message}`);
        }
    }

    async deleteCatalogItem(addonId: string) {
        try {
            const response = await firstValueFrom(
                this.httpService.delete(`${this.subBillingUrl}/addons/catalog/${addonId}`)
            );
            return response.data;
        } catch (error) {
            const status = error.response?.status || 500;
            const message = error.response?.data?.message || error.message;
            throw new BadRequestException(`Failed to delete catalog item: ${message}`);
        }
    }

    private assertResourceId(id: string): void {
        if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(id)) {
            throw new BadRequestException('Invalid resource ID');
        }
    }

    private async getOwnedSubscriptions(user: TenantPrincipal): Promise<BillingSubscription[]> {
        const tenantId = resolveTenantScope(user);
        const customerId = await this.walletService.getSubBillingCustomerId(tenantId);
        let data: any;
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.subBillingUrl}/subscriptions/customer/${encodeURIComponent(customerId)}`)
            );
            data = response.data;
        } catch (error) {
            throw new BadGatewayException('Unable to verify subscription ownership');
        }
        if (data?.success !== true || !Array.isArray(data.data) ||
            data.data.some((sub: any) => !sub || typeof sub.id !== 'string' ||
                !/^[a-zA-Z0-9_-]+$/.test(sub.id) || sub.customer_id !== customerId)) {
            throw new BadGatewayException('Unable to verify subscription ownership');
        }
        return data.data;
    }

    private async fetchSubscriptionAddons(subscriptionId: string, customerId?: string): Promise<BillingAddon[]> {
        this.assertResourceId(subscriptionId);
        let data: any;
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.subBillingUrl}/addons/subscription/${encodeURIComponent(subscriptionId)}`,
                    customerId ? { headers: { 'x-pbx-customer-id': customerId } } : undefined)
            );
            data = response.data;
        } catch (error) {
            throw new BadGatewayException('Unable to fetch subscription addons');
        }
        if (data?.success !== true || !Array.isArray(data.data) ||
            data.data.some((addon: any) => !addon || typeof addon.id !== 'string' ||
                addon.subscription_id !== subscriptionId)) {
            throw new BadGatewayException('Invalid subscription addon response');
        }
        return data.data;
    }

    async getSubscriptionAddons(user: TenantPrincipal, subscriptionId: string) {
        this.assertResourceId(subscriptionId);
        let authorizedId = subscriptionId;
        if (user.role !== Role.SUPER_ADMIN) {
            const subscriptions = await this.getOwnedSubscriptions(user);
            const owned = subscriptions.find(sub => sub.id === subscriptionId || sub.subscription_id === subscriptionId);
            if (!owned) throw new NotFoundException('Subscription not found');
            authorizedId = owned.id;
        }
        const customerId = user.role === Role.SUPER_ADMIN ? undefined :
            (await this.walletService.getSubBillingCustomerId(resolveTenantScope(user)));
        return { success: true, data: await this.fetchSubscriptionAddons(authorizedId, customerId) };
    }

    private async assertAddonOwner(user: TenantPrincipal, subscriptionAddonId: string): Promise<string | undefined> {
        this.assertResourceId(subscriptionAddonId);
        if (user.role === Role.SUPER_ADMIN) return undefined;
        // The private API has no addon-by-ID ownership endpoint. Discover the row
        // only through this customer's subscriptions; never trust a client parent ID.
        const subscriptions = await this.getOwnedSubscriptions(user);
        for (const subscription of subscriptions) {
            const addons = await this.fetchSubscriptionAddons(subscription.id, subscription.customer_id);
            if (addons.some(addon => addon.id === subscriptionAddonId)) return subscription.customer_id;
        }
        throw new NotFoundException('Subscription addon not found');
    }

    async cancelSubscriptionAddon(user: TenantPrincipal, subscriptionAddonId: string) {
        const customerId = await this.assertAddonOwner(user, subscriptionAddonId);
        try {
            const response = await firstValueFrom(
                this.httpService.delete(`${this.subBillingUrl}/addons/subscription/${encodeURIComponent(subscriptionAddonId)}`,
                    customerId ? { headers: { 'x-pbx-customer-id': customerId } } : undefined)
            );
            return response.data;
        } catch (error) {
            const status = error.response?.status || 500;
            const message = error.response?.data?.message || error.message;
            throw new BadRequestException(`Failed to cancel subscription addon: ${message}`);
        }
    }

    async toggleAutoRenew(user: TenantPrincipal, subscriptionAddonId: string, autoRenew: boolean) {
        const customerId = await this.assertAddonOwner(user, subscriptionAddonId);
        try {
            const response = await firstValueFrom(
                this.httpService.patch(`${this.subBillingUrl}/addons/subscriptions/${encodeURIComponent(subscriptionAddonId)}/auto-renew`,
                    { auto_renew: autoRenew }, customerId ? { headers: { 'x-pbx-customer-id': customerId } } : undefined)
            );
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || error.message;
            throw new BadRequestException(`Failed to toggle auto-renew: ${message}`);
        }
    }

    async getQuote(tenantId: string, addonId: string, quantity: number = 1) {
        if (!tenantId) throw new BadRequestException('Tenant ID is required');
        const qty = Number(quantity);
        if (!Number.isSafeInteger(qty) || qty < 1 || qty > 100) throw new BadRequestException('Invalid add-on quantity');

        const tenant = await this.walletService.assertActiveTenant(tenantId);
        const customerId = tenant.subBillingCustomerId!;

        // 1. Try fetching official quote from Sub-Billing
        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.subBillingUrl}/addons/quote`, {
                    customer_id: customerId,
                    addon_id: addonId,
                    quantity: qty
                }, { headers: { 'x-pbx-customer-id': customerId } })
            );
            if (response.data?.success && response.data?.data) {
                return response.data.data;
            }
        } catch (err: any) {
            this.logger.debug(`Sub-billing quote API returned error or not found, falling back to local calculation: ${err.message}`);
        }

        // 2. Dynamic catalog lookup fallback
        const catalog = await this.getCatalog();
        const addon = catalog.find(a => a.addon_id === addonId);
        if (!addon) {
            throw new NotFoundException(`Add-on with ID ${addonId} not found in catalog`);
        }

        // Fetch real-time tenant wallet balance & credit limit
        let availablePurchasingPower = 0;
        try {
            const walletData = await this.walletService.getBalance(tenantId);
            const balance = Number(walletData.balance || 0);
            const creditLimit = Number(walletData.creditLimit || 0);
            availablePurchasingPower = balance + Math.max(0, creditLimit);
        } catch (error) {
            this.logger.warn(`Could not fetch wallet balance for tenant ${tenantId}, fallback to 0: ${error.message}`);
        }

        // Fetch subscription details to calculate remaining cycle days
        let remainingDays = 28;
        let totalCycleDays = 30;
        try {
            const subscription = await this.prisma.subscription.findFirst({
                where: { tenantId, status: 'ACTIVE' }
            });

            if (subscription && subscription.endDate) {
                const diffMs = subscription.endDate.getTime() - Date.now();
                const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                remainingDays = Math.max(1, Math.min(30, diffDays));
            }
        } catch (error) {
            this.logger.warn(`Could not fetch subscription for tenant ${tenantId}, using default 28 days`);
        }

        const fraction = remainingDays / totalCycleDays;
        const proratedChargeDue = Number((addon.unit_price * qty * fraction).toFixed(2));
        const sufficientFunds = availablePurchasingPower >= proratedChargeDue;

        return {
            success: true,
            customer_id: tenantId,
            addon_id: addon.addon_id,
            name: addon.name,
            resource_type: addon.resource_type,
            quantity: qty,
            unit_price: addon.unit_price,
            remaining_days: remainingDays,
            total_cycle_days: totalCycleDays,
            prorated_charge_due: proratedChargeDue,
            available_purchasing_power: availablePurchasingPower,
            sufficient_funds: sufficientFunds
        };
    }

    async purchaseAddon(tenantId: string, addonId: string, quantity: number, idempotencyKey: string) {
        const quote = await this.getQuote(tenantId, addonId, quantity);
        if (!quote.sufficient_funds) {
            throw new BadRequestException(
                `Insufficient purchasing power ($${quote.available_purchasing_power.toFixed(2)}) for prorated charge ($${quote.prorated_charge_due.toFixed(2)})`
            );
        }

        const tenant = await this.walletService.assertActiveTenant(tenantId);
        const customerId = tenant.subBillingCustomerId!;

        // Execute purchase in Sub-Billing
        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.subBillingUrl}/addons/purchase`, {
                    customer_id: customerId,
                    addon_id: addonId,
                    quantity
                }, { headers: { 'x-pbx-customer-id': customerId, 'idempotency-key': idempotencyKey } })
            );
            this.logger.log(`Tenant ${tenantId} successfully purchased add-on ${addonId} x${quantity} in Sub-Billing`);
            return response.data;
        } catch (subErr: any) {
            this.logger.error(`Sub-billing add-on purchase failed for tenant ${tenantId}: ${subErr.message}`);
            throw new BadGatewayException('Unable to complete add-on purchase');
        }
    }
}
