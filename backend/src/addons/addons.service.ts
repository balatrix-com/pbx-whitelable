import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { TransactionType } from '@prisma/client';

export interface AddonCatalogItem {
    addon_id: string;
    name: string;
    resource_type: string;
    unit_price: number;
    price: number;
    currency: string;
    is_active: boolean;
    description: string;
}

@Injectable()
export class AddonsService {
    private readonly logger = new Logger(AddonsService.name);

    private readonly catalog: AddonCatalogItem[] = [
        {
            addon_id: 'addon_ext_1',
            name: '1 Extra Extension',
            resource_type: 'extension',
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
            unit_price: 15.00,
            price: 15.00,
            currency: 'USD',
            is_active: true,
            description: 'Real-time eavesdrop, whisper coaching, and supervisor barge'
        }
    ];

    constructor(
        private prisma: PrismaService,
        private walletService: WalletService
    ) {}

    async getCatalog(): Promise<AddonCatalogItem[]> {
        return this.catalog.filter(item => item.is_active);
    }

    async getQuote(tenantId: string, addonId: string, quantity: number = 1) {
        if (!tenantId) throw new BadRequestException('Tenant ID is required');
        const qty = Math.max(1, Number(quantity) || 1);

        const addon = this.catalog.find(a => a.addon_id === addonId);
        if (!addon) {
            throw new NotFoundException(`Add-on with ID ${addonId} not found in catalog`);
        }

        // 1. Fetch real-time tenant wallet balance & credit limit
        let availablePurchasingPower = 0;
        try {
            const walletData = await this.walletService.getBalance(tenantId);
            const balance = Number(walletData.balance || 0);
            const creditLimit = Number(walletData.creditLimit || 0);
            availablePurchasingPower = balance + Math.max(0, creditLimit);
        } catch (error) {
            this.logger.warn(`Could not fetch wallet balance for tenant ${tenantId}, fallback to 0: ${error.message}`);
        }

        // 2. Fetch subscription details to calculate remaining cycle days
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

    async purchaseAddon(tenantId: string, addonId: string, quantity: number = 1) {
        const quote = await this.getQuote(tenantId, addonId, quantity);
        if (!quote.sufficient_funds) {
            throw new BadRequestException(
                `Insufficient purchasing power ($${quote.available_purchasing_power.toFixed(2)}) for prorated charge ($${quote.prorated_charge_due.toFixed(2)})`
            );
        }

        // Debit wallet via walletService
        if (quote.prorated_charge_due > 0) {
            await this.walletService.adjustBalance(
                tenantId,
                quote.prorated_charge_due,
                TransactionType.DEBIT,
                `Purchase Add-on: ${quote.name} (Qty: ${quote.quantity})`,
                `ADDON-${addonId}-${Date.now()}`
            );
        }

        this.logger.log(`Tenant ${tenantId} successfully purchased add-on ${addonId} x${quantity}`);

        return {
            success: true,
            message: 'Add-on purchase confirmed successfully',
            data: {
                tenant_id: tenantId,
                addon_purchased: {
                    addon_id: addonId,
                    name: quote.name,
                    quantity: quote.quantity,
                    prorated_charge_paid: quote.prorated_charge_due
                }
            }
        };
    }
}
