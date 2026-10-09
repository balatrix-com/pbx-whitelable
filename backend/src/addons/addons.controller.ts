import { Controller, Get, Post, Delete, Body, Param, UseGuards, BadRequestException, Patch } from '@nestjs/common';
import { AddonsService } from './addons.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { GetUser } from '../auth/decorators/get-user.decorator';
import type { User } from '@prisma/client';
import { Audit } from '../audit/audit.decorator';

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
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    @Audit('ADDON_CATALOG_CREATED', 'PLANS_ADDONS')
    createCatalogItem(@Body() body: any) {
        return this.addonsService.createCatalogItem(body);
    }

    @Delete('catalog/:addonId')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    @Audit('ADDON_CATALOG_DELETED', 'PLANS_ADDONS')
    deleteCatalogItem(@Param('addonId') addonId: string) {
        return this.addonsService.deleteCatalogItem(addonId);
    }

    @Get('subscription/:subscriptionId')
    @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SUPPORT)
    getSubscriptionAddons(@Param('subscriptionId') subscriptionId: string) {
        return this.addonsService.getSubscriptionAddons(subscriptionId);
    }

    @Delete('subscription/:subscriptionAddonId')
    @Roles(Role.SUPER_ADMIN, Role.ADMIN)
    @Audit('ADDON_CANCELLED', 'PLANS_ADDONS')
    cancelSubscriptionAddon(@Param('subscriptionAddonId') subscriptionAddonId: string) {
        return this.addonsService.cancelSubscriptionAddon(subscriptionAddonId);
    }

    @Post('quote')
    @Roles(Role.SUPER_ADMIN, Role.ADMIN)
    getQuote(@GetUser() user: User, @Body() body: AddonQuoteDto) {
        const tenantId = body.tenantId || user.tenantId;
        if (!tenantId) {
            throw new BadRequestException('Tenant ID is required');
        }
        if (!body.addonId) {
            throw new BadRequestException('addonId is required');
        }
        return this.addonsService.getQuote(tenantId, body.addonId, body.quantity || 1);
    }

    @Post('purchase')
    @Roles(Role.SUPER_ADMIN, Role.ADMIN)
    @Audit('ADDON_PURCHASED', 'PLANS_ADDONS')
    purchaseAddon(@GetUser() user: User, @Body() body: AddonPurchaseDto) {
        const tenantId = body.tenantId || user.tenantId;
        if (!tenantId) {
            throw new BadRequestException('Tenant ID is required');
        }
        if (!body.addonId) {
            throw new BadRequestException('addonId is required');
        }
        return this.addonsService.purchaseAddon(tenantId, body.addonId, body.quantity || 1);
    }

    @Patch('subscriptions/:subscriptionAddonId/auto-renew')
    @Roles(Role.SUPER_ADMIN, Role.ADMIN)
    @Audit('ADDON_AUTO_RENEW_TOGGLED', 'PLANS_ADDONS')
    toggleAutoRenew(
        @Param('subscriptionAddonId') subscriptionAddonId: string,
        @Body('auto_renew') autoRenew: boolean
    ) {
        if (typeof autoRenew !== 'boolean') {
            throw new BadRequestException('auto_renew boolean is required');
        }
        return this.addonsService.toggleAutoRenew(subscriptionAddonId, autoRenew);
    }
}
