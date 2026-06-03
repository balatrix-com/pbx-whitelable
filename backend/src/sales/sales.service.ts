import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QuoteStatus, Prisma } from '@prisma/client';
import { PricingService } from './pricing.service';
import { AssetService } from './asset.service';

@Injectable()
export class SalesService {
    constructor(
        private prisma: PrismaService,
        private pricingService: PricingService,
        private assetService: AssetService
    ) { }

    async createQuote(createQuoteDto: any, userId: string) {
        const {
            customerName,
            customerEmail,
            customerCompany,
            planId,
            blueprintId,
            customPrice: rawCustomPrice,
            telecomDetails
        } = createQuoteDto;

        const customPrice = (rawCustomPrice && rawCustomPrice !== '') ? rawCustomPrice : null;

        let pricingSnapshot: any = {};
        let assetSnapshot: any = { tfns: [], dids: [], extensions: [] };

        // 1. Pricing Logic
        if (blueprintId) {
            // New Path
            const inputs = {
                'PER_EXTENSION': telecomDetails?.extensionCount || 0,
                'PER_DID': telecomDetails?.didCount || 0,
            };
            pricingSnapshot = await this.pricingService.calculateQuote(blueprintId, inputs);
        } else if (planId) {
            // Enhanced Plan Path with Overages & Add-ons
            const inputs = {
                extensionCount: telecomDetails?.extensionCount || 0,
                didCount: telecomDetails?.didCount || 0,
                tfnCount: telecomDetails?.selectedTfns?.length || 0,
                walletCredit: createQuoteDto.initialWalletCredit || 0,
                customItems: createQuoteDto.customItems || []
            };

            pricingSnapshot = await this.pricingService.calculatePlanQuote(planId, inputs);

            // Override total if custom price is set (Sales rep override)
            if (customPrice) {
                pricingSnapshot.subtotal = Number(customPrice);
                // We might want to keep the line items for reference but indicate override
                pricingSnapshot.overridePrice = Number(customPrice);
            }
        } else {
            throw new NotFoundException('Either Plan or Blueprint is required');
        }

        const requestedTfns: string[] = telecomDetails?.selectedTfns || [];

        // 2. Create Quote (DRAFT)
        const quote = await this.prisma.quote.create({
            data: {
                customerName,
                customerEmail,
                customerCompany,
                planId,
                blueprintId,
                customPrice,
                telecomDetails: { ...telecomDetails, initialWalletCredit: createQuoteDto.initialWalletCredit },
                pricingSnapshot: pricingSnapshot || {},
                assetSnapshot: assetSnapshot || {},
                createdBy: userId,
                status: QuoteStatus.DRAFT,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }
        });

        // 3. Reserve Assets (Saga Pattern: Compensate by deleting quote if reservation fails)
        try {
            if (requestedTfns.length > 0) {
                await this.assetService.holdSpecificAssets(requestedTfns, quote.id);
            }
        } catch (err) {
            // Rollback: Delete the created quote
            await this.prisma.quote.delete({ where: { id: quote.id } });
            throw err;
        }

        return quote;
    }

    async getNextExtensions(count: number = 1, tenantId?: string) {
        let startNumber = 1001;

        if (tenantId) {
            // If existing tenant, find max extension number and increment
            const maxExt = await this.prisma.extension.findFirst({
                where: { tenantId },
                orderBy: { extensionNumber: 'desc' },
                select: { extensionNumber: true }
            });

            if (maxExt) {
                const currentMax = parseInt(maxExt.extensionNumber, 10);
                if (!isNaN(currentMax)) {
                    startNumber = currentMax + 1;
                }
            }
        }

        const extensions: string[] = [];
        for (let i = 0; i < count; i++) {
            extensions.push((startNumber + i).toString());
        }

        return { extensions };
    }

    async getNextCustomerCode() {
        // Fetch all customer codes to find the first available gap starting from 1001
        const tenants = await this.prisma.tenant.findMany({
            where: { customerCode: { not: null } },
            select: { customerCode: true }
        });

        const codes = new Set(
            tenants
                .filter(t => t.customerCode)
                .map(t => parseInt(t.customerCode!, 10))
                .filter(c => !isNaN(c))
        );

        let nextCode = 1001;
        while (codes.has(nextCode)) {
            nextCode++;
        }

        return { nextCode: nextCode.toString() };
    }

    async findAll() {
        return this.prisma.quote.findMany({
            include: { plan: true },
            orderBy: { createdAt: 'desc' }
        });
    }

    async findOne(id: string) {
        const quote = await this.prisma.quote.findUnique({
            where: { id },
            include: { plan: true }
        });
        if (!quote) throw new NotFoundException('Quote not found');
        return quote;
    }
    async deleteQuote(id: string) {
        const quote = await this.prisma.quote.findUnique({ where: { id } });
        if (!quote) throw new NotFoundException('Quote not found');

        if (quote.status === QuoteStatus.CONVERTED) {
            throw new NotFoundException('Cannot delete converted quotes');
        }

        return this.prisma.quote.delete({ where: { id } });
    }

    async findAllBlueprints() {
        return this.prisma.pricingBlueprint.findMany({
            where: { isActive: true }
        });
    }
}
