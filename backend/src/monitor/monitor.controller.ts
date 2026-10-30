import { Controller, Get, Post, Body, UseGuards, Request, Query, BadRequestException, ForbiddenException, Header } from '@nestjs/common';
import { MonitorService } from './monitor.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FeatureGuard } from '../auth/guards/feature.guard';
import { RequireFeature } from '../auth/decorators/feature.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

function normalizeTenantId(id?: string | null): string {
    if (!id) return '';
    const trimmed = id.trim();
    return trimmed.startsWith('U') ? trimmed : `U${trimmed}`;
}

@Controller('monitor')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
@RequireFeature('monitor')
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SUPPORT)
export class MonitorController {
    constructor(private readonly monitorService: MonitorService) { }

    @Get('active-calls')
    @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SUPPORT)
    @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
    @Header('Pragma', 'no-cache')
    @Header('Expires', '0')
    async getActiveCalls(@Request() req: any, @Query('tenantId') queryTenantId?: string) {
        const user = req.user;

        // Check permissions: Super Admin and Admin have access; Support requires monitoringEnabled === true
        if (user.role !== Role.SUPER_ADMIN && user.role !== Role.ADMIN && !user.monitoringEnabled) {
            throw new ForbiddenException('Monitoring access restrictions apply. Monitoring is not enabled for your account.');
        }

        // Standard tenant isolation: non-SUPER_ADMIN users cannot query other tenants or 'all'
        if (user.role !== Role.SUPER_ADMIN) {
            if (queryTenantId && queryTenantId === 'all') {
                throw new ForbiddenException('Access denied: cannot monitor all tenants');
            }
            if (queryTenantId && normalizeTenantId(queryTenantId) !== normalizeTenantId(user.tenantId)) {
                throw new ForbiddenException('Access denied: cannot monitor other tenants');
            }
        }

        // If super admin, can request any tenant or 'all', otherwise strictly user's tenant
        const tenantId = (user.role === Role.SUPER_ADMIN && queryTenantId) ? queryTenantId : user.tenantId;

        const calls = await this.monitorService.getActiveCalls(tenantId);
        return { calls };
    }

    @Post('barge')
    @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SUPPORT)
    async initiateBarge(@Request() req: any, @Body() body: { uuid_in: string; uuid_out: string; mode: 'barge' | 'listen' | 'whisper', adminExtension?: string }) {
        const user = req.user;

        if (user.role !== Role.SUPER_ADMIN && user.role !== Role.ADMIN && !user.monitoringEnabled) {
            throw new ForbiddenException('Monitoring access restricted');
        }

        let adminExtension = body.adminExtension;
        if (user.role === Role.SUPER_ADMIN) {
            adminExtension = '999001';
            if (body.mode !== 'listen') {
                throw new BadRequestException('Super Admins are restricted to "listen" mode only');
            }
        }

        if (!body.uuid_in || !body.uuid_out || !body.mode || !adminExtension) {
            throw new BadRequestException('Missing required fields');
        }

        // For non-SUPER_ADMIN, verify that the call belongs to their tenant
        if (user.role !== Role.SUPER_ADMIN) {
            if (!user.tenantId) {
                throw new ForbiddenException('User is not assigned to a tenant');
            }
            const belongsToTenant = await this.monitorService.verifyCallTenant(body.uuid_in, user.tenantId, body.uuid_out);
            if (!belongsToTenant) {
                throw new ForbiddenException('Access denied: target call does not belong to your tenant');
            }
        }

        const result = await this.monitorService.initiateBarge(
            body.uuid_in,
            body.uuid_out,
            adminExtension,
            body.mode
        );

        return result;
    }
}
