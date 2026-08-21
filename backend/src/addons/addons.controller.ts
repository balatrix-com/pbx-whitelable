import { Controller, Get, Post, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { AddonsService } from './addons.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
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
