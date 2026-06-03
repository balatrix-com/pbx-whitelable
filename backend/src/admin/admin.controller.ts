import { Controller, Get, Param, UseGuards, Post, Body, Put, Delete } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    /**
     * GET /admin/platform/stats
     * Get platform-wide statistics (SUPER_ADMIN only)
     */
    @Get('platform/stats')
    @Roles('SUPER_ADMIN')
    getPlatformStats() {
        return this.adminService.getPlatformStats();
    }

    /**
     * GET /admin/support/stats
     * Get platform stats for Support dashboard (SUPER_ADMIN or SUPPORT)
     */
    @Get('support/stats')
    @Roles('SUPER_ADMIN', 'SUPPORT')
    getSupportStats() {
        return this.adminService.getSupportStats();
    }

    /**
     * GET /admin/tenants/:id/telecom-stats
     * Get telecom stats for a specific tenant (SUPER_ADMIN only)
     */
    @Get('tenants/:id/telecom-stats')
    @Roles('SUPER_ADMIN')
    getTenantTelecomStats(@Param('id') tenantId: string) {
        return this.adminService.getTenantTelecomStats(tenantId);
    }

    /**
     * Whitelabel Packages/Plans Management (SUPER_ADMIN only)
     */
    @Get('packages')
    @Roles('SUPER_ADMIN')
    getAllPackages() {
        return this.adminService.getAllPackages();
    }

    @Get('packages/:id')
    @Roles('SUPER_ADMIN')
    getPackage(@Param('id') id: string) {
        return this.adminService.getPackage(id);
    }

    @Post('packages')
    @Roles('SUPER_ADMIN')
    createPackage(@Body() data: any) {
        return this.adminService.createPackage(data);
    }

    @Put('packages/:id')
    @Roles('SUPER_ADMIN')
    updatePackage(@Param('id') id: string, @Body() data: any) {
        return this.adminService.updatePackage(id, data);
    }

    @Delete('packages/:id')
    @Roles('SUPER_ADMIN')
    deletePackage(@Param('id') id: string) {
        return this.adminService.deletePackage(id);
    }

    /**
     * Rate Card Management (SUPER_ADMIN only)
     */
    @Get('rate-cards')
    @Roles('SUPER_ADMIN')
    getAllRateCards() {
        return this.adminService.getAllRateCards();
    }

    @Get('rate-cards/mappings')
    @Roles('SUPER_ADMIN')
    getCustomerRateCardMappings() {
        return this.adminService.getCustomerRateCardMappings();
    }

    @Get('rate-cards/:id')
    @Roles('SUPER_ADMIN')
    getRateCard(@Param('id') id: string) {
        return this.adminService.getRateCard(id);
    }

    @Post('rate-cards')
    @Roles('SUPER_ADMIN')
    createRateCard(@Body() data: any) {
        return this.adminService.createRateCard(data);
    }

    @Put('rate-cards/:id')
    @Roles('SUPER_ADMIN')
    updateRateCard(@Param('id') id: string, @Body() data: any) {
        return this.adminService.updateRateCard(id, data);
    }

    @Post('rate-cards/mappings')
    @Roles('SUPER_ADMIN')
    updateCustomerRateCardMapping(@Body() data: { customer_id: string; ratecard_id: number }) {
        return this.adminService.updateCustomerRateCardMapping(data);
    }

    /**
     * Number Management (TFN & DID)
     */
    @Get('numbers')
    @Roles('SUPER_ADMIN')
    getAllNumbers() {
        return this.adminService.getAllNumbers();
    }

    @Post('numbers/tfn')
    @Roles('SUPER_ADMIN')
    addTFN(@Body() data: { number: string; price?: number; isDemo?: boolean }) {
        return this.adminService.addTFN(data);
    }


    @Post('numbers/did')
    @Roles('SUPER_ADMIN')
    addDID(@Body() data: { number: string; monthlyFee?: number; provider?: string }) {
        return this.adminService.addDID(data);
    }

    @Post('numbers/assign')
    @Roles('SUPER_ADMIN')
    assignNumber(@Body() data: { type: 'TFN' | 'DID'; id: string; tenantId: string }) {
        return this.adminService.assignNumber(data.type, data.id, data.tenantId);
    }

    @Post('numbers/unassign')
    @Roles('SUPER_ADMIN')
    unassignNumber(@Body() data: { type: 'TFN' | 'DID'; id: string }) {
        return this.adminService.unassignNumber(data.type, data.id);
    }

    @Post('numbers/delete')
    @Roles('SUPER_ADMIN')
    deleteNumber(@Body() data: { type: 'TFN' | 'DID'; id: string }) {
        return this.adminService.deleteNumber(data.type, data.id);
    }
}
