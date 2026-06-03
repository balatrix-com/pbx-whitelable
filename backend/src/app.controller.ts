import { Controller, Get, Query, Req } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('branding')
  async getBranding(@Query('domain') domainParam?: string, @Req() req?: any) {
    let domain = domainParam;
    if (!domain && req && req.headers) {
      domain = req.headers.host || req.headers.Host;
    }

    if (domain) {
      domain = domain.split(':')[0].toLowerCase();
    }

    const defaultBranding = {
      name: 'Balatrix',
      logoMain: '/svg logo/Balatrix final logo 1.svg',
      logoSidebar: '/svg logo/Balatrix final logo 1.svg',
      favicon: '/svg logo/Balatrix final logo 5.svg',
      primaryColor: '#3d52a0',
      accentColor: '#ed8f55',
      supportEmail: 'support@balatrix.com',
      supportPhone: '+1-800-555-0199',
    };

    if (!domain) {
      return defaultBranding;
    }

    try {
      const partner = await this.prisma.partner.findUnique({
        where: { domain }
      });

      if (!partner) {
        return defaultBranding;
      }

      return {
        name: partner.name,
        logoMain: partner.logoMain || defaultBranding.logoMain,
        logoSidebar: partner.logoSidebar || defaultBranding.logoSidebar,
        favicon: partner.favicon || defaultBranding.favicon,
        primaryColor: partner.primaryColor || defaultBranding.primaryColor,
        accentColor: partner.accentColor || defaultBranding.accentColor,
        supportEmail: partner.supportEmail || defaultBranding.supportEmail,
        supportPhone: partner.supportPhone || defaultBranding.supportPhone,
      };
    } catch (error) {
      return defaultBranding;
    }
  }
}

