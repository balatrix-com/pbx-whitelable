import { Controller, Get, Post, Delete, Body, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { AddonsService } from './addons.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { GetUser } from '../auth/decorators/get-user.decorator';
import type { User } from '@prisma/client';

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
    getCatalog() {
        return this.addonsService.getCatalog();
    }

    @Post('catalog')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    createCatalogItem(@Body() body: any) {
        return this.addonsService.createCatalogItem(body);
    }

    @Delete('catalog/:addonId')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    deleteCatalogItem(@Param('addonId') addonId: string) {
        return this.addonsService.deleteCatalogItem(addonId);
    }

    @Get('subscription/:subscriptionId')
    getSubscriptionAddons(@Param('subscriptionId') subscriptionId: string) {
        return this.addonsService.getSubscriptionAddons(subscriptionId);
    }

    @Delete('subscription/:subscriptionAddonId')
    cancelSubscriptionAddon(@Param('subscriptionAddonId') subscriptionAddonId: string) {
        return this.addonsService.cancelSubscriptionAddon(subscriptionAddonId);
    }

    @Post('quote')
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
}
