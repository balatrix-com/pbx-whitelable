import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KamailioDBService } from '../freeswitch/kamailio-db.service';

@Injectable()
export class CarriersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kamailioDb: KamailioDBService,
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
    const endpoints = await this.prisma.outboundEndpoint.findMany({
      where: { carrierId: id },
    });
    
    for (const ep of endpoints) {
      if (ep.isActive) {
        await this.kamailioDb.removeCarrierIP(ep.sipHost, ep.sipPort);
      }
    }
    
    return this.prisma.outboundCarrier.delete({
      where: { id },
    });
  }

  async createEndpoint(carrierId: number, data: any) {
    const endpoint = await this.prisma.outboundEndpoint.create({
      data: {
        ...data,
        carrierId,
      },
    });

    if (endpoint.isActive) {
      await this.kamailioDb.addCarrierIP(endpoint.sipHost, endpoint.sipPort, endpoint.name);
    }

    return endpoint;
  }

  async updateEndpoint(id: number, data: any) {
    const oldEndpoint = await this.prisma.outboundEndpoint.findUnique({ where: { id } });
    if (!oldEndpoint) throw new NotFoundException('Endpoint not found');

    const endpoint = await this.prisma.outboundEndpoint.update({
      where: { id },
      data,
    });

    // Handle Kamailio sync
    if (oldEndpoint.isActive && (!endpoint.isActive || oldEndpoint.sipHost !== endpoint.sipHost || oldEndpoint.sipPort !== endpoint.sipPort)) {
      await this.kamailioDb.removeCarrierIP(oldEndpoint.sipHost, oldEndpoint.sipPort);
    }

    if (endpoint.isActive && (!oldEndpoint.isActive || oldEndpoint.sipHost !== endpoint.sipHost || oldEndpoint.sipPort !== endpoint.sipPort)) {
      await this.kamailioDb.addCarrierIP(endpoint.sipHost, endpoint.sipPort, endpoint.name);
    }

    return endpoint;
  }

  async deleteEndpoint(id: number) {
    const endpoint = await this.prisma.outboundEndpoint.findUnique({ where: { id } });
    if (!endpoint) throw new NotFoundException('Endpoint not found');

    if (endpoint.isActive) {
      await this.kamailioDb.removeCarrierIP(endpoint.sipHost, endpoint.sipPort);
    }

    return this.prisma.outboundEndpoint.delete({
      where: { id },
    });
  }
}
