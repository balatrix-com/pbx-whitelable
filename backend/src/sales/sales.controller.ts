import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request, Query, UseInterceptors } from '@nestjs/common';
import { SalesService } from './sales.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
    constructor(private readonly salesService: SalesService) { }

    @Post('quotes')
    @UseInterceptors(IdempotencyInterceptor)
    @Roles(Role.SALES, Role.SUPER_ADMIN)
    create(@Body() createQuoteDto: any, @Request() req: any) {
        return this.salesService.createQuote(createQuoteDto, req.user.id);
    }

    @Get('extensions/next')
    @Roles(Role.SALES, Role.SUPER_ADMIN)
    getNextExtensions(@Query('count') count: string = '1', @Query('tenantId') tenantId?: string) {
        return this.salesService.getNextExtensions(parseInt(count, 10), tenantId);
    }

    @Get('customer-code/next')
    @Roles(Role.SALES, Role.SUPER_ADMIN)
    getNextCustomerCode() {
        return this.salesService.getNextCustomerCode();
    }

    @Get('quotes')
    @Roles(Role.SALES, Role.SUPER_ADMIN)
    findAll() {
        return this.salesService.findAll();
    }

    @Get('quotes/:id')
    @Roles(Role.SALES, Role.SUPER_ADMIN)
    findOne(@Param('id') id: string) {
        return this.salesService.findOne(id);
    }

    @Delete('quotes/:id')
    @Roles(Role.SALES, Role.SUPER_ADMIN)
    delete(@Param('id') id: string) {
        return this.salesService.deleteQuote(id);
    }

    @Get('blueprints')
    @Roles(Role.SALES, Role.SUPER_ADMIN)
    getBlueprints() {
        return this.salesService.findAllBlueprints();
    }
}
