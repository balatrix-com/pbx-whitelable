import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { CarriersService } from './carriers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('carriers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class CarriersController {
  constructor(private readonly carriersService: CarriersService) {}

  @Get()
  async getCarriers() {
    return this.carriersService.getCarriers();
  }

  @Post()
  async createCarrier(@Body() data: { name: string }) {
    return this.carriersService.createCarrier(data);
  }

  @Put(':id')
  async updateCarrier(@Param('id') id: string, @Body() data: { name: string }) {
    return this.carriersService.updateCarrier(parseInt(id, 10), data);
  }

  @Delete(':id')
  async deleteCarrier(@Param('id') id: string) {
    return this.carriersService.deleteCarrier(parseInt(id, 10));
  }

  @Post(':id/endpoints')
  async createEndpoint(
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return this.carriersService.createEndpoint(parseInt(id, 10), data);
  }

  @Put(':carrierId/endpoints/:endpointId')
  async updateEndpoint(
    @Param('endpointId') endpointId: string,
    @Body() data: any,
  ) {
    return this.carriersService.updateEndpoint(parseInt(endpointId, 10), data);
  }

  @Delete(':carrierId/endpoints/:endpointId')
  async deleteEndpoint(@Param('endpointId') endpointId: string) {
    return this.carriersService.deleteEndpoint(parseInt(endpointId, 10));
  }
}
