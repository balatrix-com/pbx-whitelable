import { Controller, Get, Post, Delete, Body, Param, UseGuards, BadRequestException, Patch, Headers } from '@nestjs/common';
import { AddonsService, BillingAddon } from './addons.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { GetUser } from '../auth/decorators/get-user.decorator';
import type { User } from '@prisma/client';
import { Audit } from '../audit/audit.decorator';
import { resolveTenantScope } from '../auth/tenant-scope';

class AddonQuoteDto {
    tenantId?: string;
    addonId: string;
    quantity?: number;
}

class AddonPurchaseDto {
    tenantId?: string;
    addonId: string;
    quantity?: number;
}

@Controller('addons')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AddonsController {
    constructor(private readonly addonsService: AddonsService) {}

    @Get('catalog')
    @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SUPPORT)
    getCatalog() {
        return this.addonsService.getCatalog();
    }

    @Post('catalog')
    @Roles(Role.SUPER_ADMIN)
    @Audit('ADDON_CATALOG_CREATED', 'PLANS_ADDONS')
    createCatalogItem(@Body() body: any) {
        return this.addonsService.createCatalogItem(body);
    }

    @Delete('catalog/:addonId')
    @Roles(Role.SUPER_ADMIN)
    @Audit('ADDON_CATALOG_DELETED', 'PLANS_ADDONS')
    deleteCatalogItem(@Param('addonId') addonId: string) {
        return this.addonsService.deleteCatalogItem(addonId);
    }

    @Get('subscription/:subscriptionId')
    @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SUPPORT)
    getSubscriptionAddons(@GetUser() user: User, @Param('subscriptionId') subscriptionId: string) {
        return this.addonsService.getSubscriptionAddons(user, subscriptionId);
    }

    @Delete('subscription/:subscriptionAddonId')
    @Roles(Role.SUPER_ADMIN, Role.ADMIN)
    @Audit('ADDON_CANCELLED', 'PLANS_ADDONS')
    cancelSubscriptionAddon(@GetUser() user: User, @Param('subscriptionAddonId') subscriptionAddonId: string) {
        return this.addonsService.cancelSubscriptionAddon(user, subscriptionAddonId);
    }

    @Post('quote')
    @Roles(Role.SUPER_ADMIN, Role.ADMIN)
    getQuote(@GetUser() user: User, @Body() body: AddonQuoteDto) {
        const tenantId = resolveTenantScope(user, body.tenantId);
        if (!body.addonId) {
            throw new BadRequestException('addonId is required');
        }
        return this.addonsService.getQuote(tenantId, body.addonId, body.quantity || 1);
    }

    @Post('purchase')
    @Roles(Role.SUPER_ADMIN, Role.ADMIN)
    @Audit('ADDON_PURCHASED', 'PLANS_ADDONS')
    purchaseAddon(@GetUser() user: User, @Body() body: AddonPurchaseDto, @Headers('idempotency-key') idempotencyKey: string) {
        const tenantId = resolveTenantScope(user, body.tenantId);
        if (!body.addonId) {
            throw new BadRequestException('addonId is required');
        }
        if (!idempotencyKey || !/^[a-zA-Z0-9_-]{16,128}$/.test(idempotencyKey)) {
            throw new BadRequestException('A valid Idempotency-Key header is required');
        }
        return this.addonsService.purchaseAddon(tenantId, body.addonId, body.quantity || 1, idempotencyKey);
    }

    @Patch('subscriptions/:subscriptionAddonId/auto-renew')
    @Roles(Role.SUPER_ADMIN, Role.ADMIN)
    @Audit('ADDON_AUTO_RENEW_TOGGLED', 'PLANS_ADDONS')
    toggleAutoRenew(
        @GetUser() user: User,
        @Param('subscriptionAddonId') subscriptionAddonId: string,
        @Body('auto_renew') autoRenew: boolean
    ) {
        if (typeof autoRenew !== 'boolean') {
            throw new BadRequestException('auto_renew boolean is required');
        }
        return this.addonsService.toggleAutoRenew(user, subscriptionAddonId, autoRenew);
    }
}
