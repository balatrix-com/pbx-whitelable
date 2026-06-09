import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CarriersService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getCarriers() {
    return this.prisma.outboundCarrier.findMany({
      include: {
        endpoints: true,
      },
    });
  }

  async createCarrier(data: { name: string }) {
    return this.prisma.outboundCarrier.create({
      data,
    });
  }

  async updateCarrier(id: number, data: { name: string }) {
    return this.prisma.outboundCarrier.update({
      where: { id },
      data,
    });
  }

  async deleteCarrier(id: number) {
    return this.prisma.outboundCarrier.delete({
      where: { id },
    });
  }

  async createEndpoint(carrierId: number, data: any) {
    return this.prisma.outboundEndpoint.create({
      data: {
        ...data,
        carrierId,
      },
    });
  }

  async updateEndpoint(id: number, data: any) {
    const oldEndpoint = await this.prisma.outboundEndpoint.findUnique({ where: { id } });
    if (!oldEndpoint) throw new NotFoundException('Endpoint not found');

    return this.prisma.outboundEndpoint.update({
      where: { id },
      data,
    });
  }

  async deleteEndpoint(id: number) {
    const endpoint = await this.prisma.outboundEndpoint.findUnique({ where: { id } });
    if (!endpoint) throw new NotFoundException('Endpoint not found');

    return this.prisma.outboundEndpoint.delete({
      where: { id },
    });
  }
}
