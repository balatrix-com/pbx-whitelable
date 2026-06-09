import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { InboundWhitelistService } from './inbound-whitelist.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('inbound-whitelist')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class InboundWhitelistController {
  constructor(private readonly inboundWhitelistService: InboundWhitelistService) {}

  @Get()
  async findAll() {
    return this.inboundWhitelistService.findAll();
  }

  @Post()
  async create(@Body() data: { ipAddress: string; port?: number; tag: string }) {
    return this.inboundWhitelistService.create(data);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() data: { ipAddress?: string; port?: number; tag?: string },
  ) {
    return this.inboundWhitelistService.update(parseInt(id, 10), data);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.inboundWhitelistService.remove(parseInt(id, 10));
  }
}
