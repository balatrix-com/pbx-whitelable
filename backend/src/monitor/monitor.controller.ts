import { Controller, Get, Post, Body, UseGuards, Request, Query, BadRequestException, ForbiddenException } from '@nestjs/common';
import { MonitorService } from './monitor.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FeatureGuard } from '../auth/guards/feature.guard';
import { RequireFeature } from '../auth/decorators/feature.decorator';

@Controller('monitor')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
@RequireFeature('monitor')
export class MonitorController {
    constructor(private readonly monitorService: MonitorService) { }

    @Get('active-calls')
    async getActiveCalls(@Request() req: any, @Query('tenantId') queryTenantId?: string) {
        const user = req.user;

        // Check permissions
        if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN' && !user.monitoringEnabled) {
            throw new ForbiddenException('Monitoring access restrictions apply');
        }

        // If super admin, can request any tenant, otherwise strictly user's tenant
        const tenantId = (user.role === 'SUPER_ADMIN' && queryTenantId) ? queryTenantId : user.tenantId;

        const calls = await this.monitorService.getActiveCalls(tenantId);
        return { calls };
    }

    @Post('barge')
    async initiateBarge(@Request() req: any, @Body() body: { uuid_in: string; uuid_out: string; mode: 'barge' | 'listen' | 'whisper', adminExtension: string }) {
        const user = req.user;

        if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN' && !user.monitoringEnabled) {
            throw new ForbiddenException('Monitoring access restricted');
        }

        if (!body.uuid_in || !body.uuid_out || !body.mode || !body.adminExtension) {
            throw new BadRequestException('Missing required fields');
        }

        const result = await this.monitorService.initiateBarge(
            body.uuid_in,
            body.uuid_out,
            body.adminExtension,
            body.mode
        );

        return result;
    }
}
