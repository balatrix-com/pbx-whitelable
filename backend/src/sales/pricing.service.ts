import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PricingService {
    constructor(private prisma: PrismaService) { }

    async calculateQuote(blueprintId: string, inputs: Record<string, number>) {
        const blueprint = await this.prisma.pricingBlueprint.findUnique({
            where: { id: blueprintId },
        });

        if (!blueprint) {
            throw new Error('Pricing Blueprint not found');
        }

        const components = blueprint.components as any[];
        const currency = 'USD'; // Default from blueprint if exists

        // 1. Calculate Line Items
        const items = components.map((comp) => {
            const quantity = inputs[comp.type] || 0;
            // TODO: Apply Volume Rules here (e.g. if qty > rule.threshold)

            const total = Number(comp.unit_price) * quantity;

            return {
                label: comp.type,
                quantity,
                unitPrice: Number(comp.unit_price),
                total,
                billingCycle: comp.billing_cycle
            };
        });

        // 2. Aggregate Totals
        const subtotal = items.reduce((sum, item) => sum + item.total, 0);
        const totalRecurring = items
            .filter(i => i.billingCycle === 'monthly')
            .reduce((sum, i) => sum + i.total, 0);
        const totalOneTime = items
            .filter(i => i.billingCycle === 'one_time')
            .reduce((sum, i) => sum + i.total, 0);

        return {
            items,
            subtotal,
            totalRecurring,
            totalOneTime,
            currency
        };
    }

    async calculatePlanQuote(planId: string, inputs: {
        extensionCount: number;
        didCount: number;
        tfnCount: number;
        walletCredit?: number;
        customItems?: { description: string; price: number; quantity: number }[];
    }) {
        const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
        if (!plan) throw new Error('Plan not found');

        const currency = 'USD';
        const items: any[] = [];

        // 1. Base Plan
        items.push({
            label: `Base Plan (${plan.name})`,
            quantity: 1,
            unitPrice: Number(plan.price),
            total: Number(plan.price),
            billingCycle: plan.billingCycle.toLowerCase() // Ensure casing matches frontend expectation
        });

        // 2. Extensions
        const includedExtensions = plan.maxExtensions === 0 ? 999999 : plan.maxExtensions;
        const extraExtensions = Math.max(0, inputs.extensionCount - includedExtensions);

        if (extraExtensions > 0) {
            items.push({
                label: 'Additional Extensions',
                quantity: extraExtensions,
                unitPrice: Number(plan.extraExtensionPrice),
                total: Number(plan.extraExtensionPrice) * extraExtensions,
                billingCycle: 'monthly'
            });
        }

        // 3. DIDs
        const includedDids = plan.maxDIDs === 0 ? 999999 : plan.maxDIDs;
        const extraDids = Math.max(0, inputs.didCount - includedDids);

        if (extraDids > 0) {
            items.push({
                label: 'Additional Numbers',
                quantity: extraDids,
                unitPrice: Number(plan.extraDidPrice),
                total: Number(plan.extraDidPrice) * extraDids,
                billingCycle: 'monthly'
            });
        }

        // 4. TFNs
        const includedTfns = plan.maxTFNs === 0 ? 999999 : plan.maxTFNs;
        const extraTfns = Math.max(0, inputs.tfnCount - includedTfns);

        if (extraTfns > 0) {
            items.push({
                label: 'Additional Toll-Free Numbers',
                quantity: extraTfns,
                unitPrice: Number(plan.extraTfnPrice),
                total: Number(plan.extraTfnPrice) * extraTfns,
                billingCycle: 'monthly'
            });
        }

        // 5. Wallet Credit
        if (inputs.walletCredit && inputs.walletCredit > 0) {
            items.push({
                label: 'Initial Wallet Credit',
                quantity: 1,
                unitPrice: Number(inputs.walletCredit),
                total: Number(inputs.walletCredit),
                billingCycle: 'one_time'
            });
        }

        // 5. Custom Items
        if (inputs.customItems && inputs.customItems.length > 0) {
            for (const item of inputs.customItems) {
                items.push({
                    label: item.description,
                    quantity: item.quantity,
                    unitPrice: Number(item.price),
                    total: Number(item.price) * item.quantity,
                    billingCycle: 'one_time' // Defaulting to one-time for now
                });
            }
        }

        // Aggregation
        const subtotal = items.reduce((sum, i) => sum + i.total, 0);
        const totalRecurring = items
            .filter(i => i.billingCycle === 'monthly' || i.billingCycle === 'yearly')
            .reduce((sum, i) => sum + i.total, 0);
        const totalOneTime = items
            .filter(i => i.billingCycle === 'one_time')
            .reduce((sum, i) => sum + i.total, 0);

        return {
            items,
            subtotal,
            totalRecurring,
            totalOneTime,
            currency
        };
    }
}
