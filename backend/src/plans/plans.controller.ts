import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { PlansService } from './plans.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Role } from '@prisma/client';
import type { User } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('plans')
@UseGuards(JwtAuthGuard)
export class PlansController {
    constructor(private readonly plansService: PlansService) { }

    @Get()
    async findAll(@GetUser() user: User) {
        return this.plansService.findAll(user.id);
    }

    @Post()
    @Roles(Role.SALES, Role.ADMIN, Role.SUPER_ADMIN)
    @UseGuards(RolesGuard)
    async createCustom(@Body() data: any, @GetUser() user: User) {
        return this.plansService.createCustom(data, user.id);
    }
}
