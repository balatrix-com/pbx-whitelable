import { Controller, Get, Post, Body, UseGuards, Query, ForbiddenException, BadRequestException, Patch } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Role, TransactionType } from '@prisma/client';
import type { User } from '@prisma/client';

class TopUpDto {
    amount: number;
}
class AutoRechargeDto {
    enabled: boolean;
    threshold: number;
    amount: number;
}

@Controller('wallet')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SUPPORT)
export class WalletController {
    constructor(private readonly walletService: WalletService) { }

    @Get()
    getBalance(@GetUser() user: User) {
        if (!user.tenantId) {
            return {
                balance: 0,
                currency: 'USD',
                autoRecharge: { enabled: false, threshold: 0, amount: 0 }
            };
        }
        return this.walletService.getBalance(user.tenantId);
    }

    @Get('transactions')
    getTransactions(@GetUser() user: User) {
        if (!user.tenantId) return [];
        return this.walletService.getTransactions(user.tenantId);
    }

    @Get('subscription')
    getSubscription(
        @GetUser() user: User,
        @Query('tenantId') queryTenantId?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
        @Query('status') status?: string,
        @Query('hasSubscription') hasSubscription?: string
    ) {
        if (queryTenantId === 'all') {
            if (user.role !== Role.SUPER_ADMIN) {
                throw new ForbiddenException('Only SuperAdmin can view all subscriptions');
            }
            return this.walletService.getAllSubscriptions({
                page: page ? parseInt(page, 10) : undefined,
                limit: limit ? parseInt(limit, 10) : undefined,
                search,
                status,
                hasSubscription: hasSubscription !== undefined ? hasSubscription === 'true' : undefined
            });
        }
        if (user.role !== Role.SUPER_ADMIN && queryTenantId && queryTenantId !== user.tenantId) {
            throw new ForbiddenException('Access denied: cannot view subscription for other tenants');
        }
        const tenantId = (user.role === Role.SUPER_ADMIN && queryTenantId) ? queryTenantId : user.tenantId;
        if (!tenantId) return null;
        return this.walletService.getSubscription(tenantId);
    }

    @Post('subscription')
    @Roles(Role.SUPER_ADMIN)
    switchSubscription(
        @GetUser() user: User,
        @Body('targetTenantId') targetTenantId: string,
        @Body('planId') planId: string,
        @Body('immediate') immediate?: boolean
    ) {
        if (user.role !== Role.SUPER_ADMIN) {
            throw new ForbiddenException('Only SuperAdmin can modify subscriptions or assign plans');
        }
        const tenantId = targetTenantId || user.tenantId;
        if (!tenantId) throw new BadRequestException('Tenant ID is required');
        if (!planId) throw new BadRequestException('Plan ID is required');
        return this.walletService.switchSubscriptionPlan(tenantId, planId, immediate ?? false);
    }

    @Post('subscription/cancel-switch')
    @Roles(Role.SUPER_ADMIN)
    cancelScheduledSwitch(
        @GetUser() user: User,
        @Body('targetTenantId') targetTenantId?: string
    ) {
        if (user.role !== Role.SUPER_ADMIN) {
            throw new ForbiddenException('Only SuperAdmin can cancel scheduled plan switches');
        }
        const tenantId = targetTenantId || user.tenantId;
        if (!tenantId) throw new BadRequestException('Tenant ID is required');
        return this.walletService.cancelScheduledPlanSwitch(tenantId);
    }

    @Patch('subscription/auto-renew')
    @Roles(Role.SUPER_ADMIN)
    toggleAutoRenew(
        @GetUser() user: User,
        @Body('targetTenantId') targetTenantId: string,
        @Body('auto_renew') autoRenew: boolean
    ) {
        if (user.role !== Role.SUPER_ADMIN) {
            throw new ForbiddenException('Only SuperAdmin can modify subscription auto-renew settings');
        }
        const tenantId = targetTenantId || user.tenantId;
        if (!tenantId) throw new BadRequestException('Tenant ID is required');
        if (typeof autoRenew !== 'boolean') throw new BadRequestException('auto_renew boolean is required');
        return this.walletService.toggleSubscriptionAutoRenew(tenantId, autoRenew);
    }

    @Get('cards')
    getCards(@GetUser() user: User) {
        return [];
    }

    @Post('topup')
    topUp() {
        throw new ForbiddenException('Self-service top-up is disabled. Account balances are managed manually by administration.');
    }

    @Post('auto-recharge')
    autoRecharge() {
        throw new ForbiddenException('Auto-recharge is disabled. Account balances are managed manually by administration.');
    }

    @Get('payment-details')
    getPaymentDetails(@GetUser() user: User) {
        if (user.role === Role.SUPER_ADMIN) {
            return this.walletService.getAllPaymentDetails();
        }
        if (!user.tenantId) {
            return [];
        }
        return this.walletService.getPaymentDetails(user.tenantId);
    }

    @Get('all-balances')
    @Roles(Role.SUPER_ADMIN)
    getAllBalances() {
        return this.walletService.getAllBalances();
    }

    @Get('all-subscriptions')
    @Roles(Role.SUPER_ADMIN)
    getAllSubscriptions(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
        @Query('status') status?: string,
        @Query('hasSubscription') hasSubscription?: string
    ) {
        return this.walletService.getAllSubscriptions({
            page: page ? parseInt(page, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
            search,
            status,
            hasSubscription: hasSubscription !== undefined ? hasSubscription === 'true' : undefined
        });
    }

    @Get('assets')
    getAssets(@GetUser() user: User, @Query('tenantId') queryTenantId?: string) {
        const tenantId = (user.role === Role.SUPER_ADMIN && queryTenantId) ? queryTenantId : user.tenantId;
        if (!tenantId) return { tfns: [], dids: [], extensions: [], totals: { tfns: 0, dids: 0, extensions: 0 } };
        return this.walletService.getAssets(tenantId);
    }

    // Admin Internal Adjustment
    @Post('internal-adjust')
    @Roles(Role.SUPER_ADMIN)
    async internalAdjust(
        @GetUser() user: User,
        @Body('targetTenantId') targetTenantId: string,
        @Body('amount') amount: number,
        @Body('type') type: TransactionType,
        @Body('description') description: string
    ) {
        if (user.role !== Role.SUPER_ADMIN) {
            throw new ForbiddenException('Only Platform Owner can perform internal adjustments');
        }

        const tenantId = targetTenantId || user.tenantId!; // Default to self if not provided
        return this.walletService.adjustBalance(tenantId, amount, type, description, `MANUAL-ADJ-BY-${user.email}`);
    }

    @Post('credit-limit')
    @Roles(Role.SUPER_ADMIN)
    async updateCreditLimit(
        @GetUser() user: User,
        @Body('targetTenantId') targetTenantId: string,
        @Body('creditLimit') creditLimit: number
    ) {
        if (user.role !== Role.SUPER_ADMIN) {
            throw new ForbiddenException('Only Platform Owner can edit credit limit');
        }
        if (!targetTenantId) {
            throw new BadRequestException('Target tenant ID is required');
        }
        return this.walletService.updateCreditLimit(targetTenantId, creditLimit);
    }
}
