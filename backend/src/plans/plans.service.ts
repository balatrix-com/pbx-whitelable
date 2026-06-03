import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BillingCycle, Tier } from '@prisma/client';

@Injectable()
export class PlansService implements OnModuleInit {
    constructor(private prisma: PrismaService) { }

    async onModuleInit() {
        await this.seedPlans();
    }

    async seedPlans() {
        const plans = [
            { name: 'Standard Monthly', billingCycle: BillingCycle.MONTHLY, tier: Tier.STANDARD, price: 9.99, freeMinutes: 100 },
            { name: 'Standard Yearly', billingCycle: BillingCycle.YEARLY, tier: Tier.STANDARD, price: 99.99, freeMinutes: 100 },
            { name: 'Premium Monthly', billingCycle: BillingCycle.MONTHLY, tier: Tier.PREMIUM, price: 19.99, freeMinutes: 500 },
            { name: 'Premium Yearly', billingCycle: BillingCycle.YEARLY, tier: Tier.PREMIUM, price: 199.99, freeMinutes: 500 },
            { name: 'Enterprise Monthly', billingCycle: BillingCycle.MONTHLY, tier: Tier.ENTERPRISE, price: 49.99, freeMinutes: 1000 },
            { name: 'Enterprise Yearly', billingCycle: BillingCycle.YEARLY, tier: Tier.ENTERPRISE, price: 499.99, freeMinutes: 1000 },
        ];

        for (const plan of plans) {
            const exists = await this.prisma.plan.findFirst({
                where: { name: plan.name, billingCycle: plan.billingCycle, tier: plan.tier },
            });

            if (!exists) {
                await this.prisma.plan.create({ data: plan });
                console.log(`Seeded plan: ${plan.name}`);
            }
        }
    }

    async findAll(userId?: string) {
        return this.prisma.plan.findMany({
            where: {
                OR: [
                    { isCustom: false },
                    userId ? { isCustom: true, createdBy: userId } : undefined
                ].filter(Boolean) as any
            },
            orderBy: [
                { isCustom: 'asc' }, // Standard first
                { tier: 'asc' },
                { billingCycle: 'asc' }
            ]
        });
    }

    async createCustom(data: any, userId: string) {
        // Validate or set defaults for custom plans
        return this.prisma.plan.create({
            data: {
                ...data,
                isCustom: true,
                createdBy: userId,
                // Ensure required enums are set if not provided, though frontend should send them
                tier: data.tier || Tier.BASIC,
                billingCycle: data.billingCycle || BillingCycle.MONTHLY,
                // Default limits if not provided
                maxDIDs: data.maxDIDs || 0,
                maxTFNs: data.maxTFNs || 0,
                maxExtensions: data.maxExtensions || 0,
                maxRingGroups: data.maxRingGroups || 0,
                maxIVRs: data.maxIVRs || 0,
                maxDIDForwards: data.maxDIDForwards || 0,
                // Feature gates
                allowSchedules: data.allowSchedules || false,
                allowDIDForwards: data.allowDIDForwards || false,
                allowCallRecording: data.allowCallRecording || false,
                allowVoicemail: data.allowVoicemail ?? true,
                initialCredit: data.initialCredit || 0
            }
        });
    }
}
