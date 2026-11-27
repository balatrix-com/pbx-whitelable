import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    UseGuards,
    ForbiddenException,
} from '@nestjs/common';
import { OperationalSchedulesService } from './operational-schedules.service';
import { CreateScheduleDto, UpdateScheduleDto } from './dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { FeatureGuard } from '../../auth/guards/feature.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { RequireFeature } from '../../auth/decorators/feature.decorator';

@Controller('telecom/schedules')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
@RequireFeature('scheduler')
export class OperationalSchedulesController {
    constructor(
        private readonly schedulesService: OperationalSchedulesService,
    ) { }

    private tenantId(user: { tenantId?: string | null }): string {
        if (!user?.tenantId) throw new ForbiddenException('A tenant account is required to manage operational schedules');
        return user.tenantId;
    }

    /**
     * GET /telecom/schedules
     * List all schedules for tenant
     */
    @Get()
    @Roles('ADMIN', 'SUPPORT', 'SUPER_ADMIN')
    findAll(@GetUser() user: any) {
        return this.schedulesService.findAll(this.tenantId(user));
    }

    /**
     * GET /telecom/schedules/:id
     * Get single schedule by ID
     */
    @Get(':id')
    @Roles('ADMIN', 'SUPPORT', 'SUPER_ADMIN')
    findOne(@GetUser() user: any, @Param('id') id: string) {
        return this.schedulesService.findOne(this.tenantId(user), id);
    }

    /**
     * POST /telecom/schedules
     * Create new schedule
     */
    @Post()
    @Roles('ADMIN', 'SUPPORT', 'SUPER_ADMIN')
    create(@GetUser() user: any, @Body() dto: CreateScheduleDto) {
        return this.schedulesService.create(this.tenantId(user), dto);
    }

    /**
     * PUT /telecom/schedules/:id
     * Update schedule
     */
    @Put(':id')
    @Roles('ADMIN', 'SUPPORT', 'SUPER_ADMIN')
    update(
        @GetUser() user: any,
        @Param('id') id: string,
        @Body() dto: UpdateScheduleDto,
    ) {
        return this.schedulesService.update(this.tenantId(user), id, dto);
    }

    /**
     * DELETE /telecom/schedules/:id
     * Delete schedule
     */
    @Delete(':id')
    @Roles('ADMIN', 'SUPPORT', 'SUPER_ADMIN')
    remove(@GetUser() user: any, @Param('id') id: string) {
        return this.schedulesService.remove(this.tenantId(user), id);
    }
}
