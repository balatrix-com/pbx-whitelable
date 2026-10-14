import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Role, UserStatus } from '@prisma/client';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(configService: ConfigService, private readonly prisma: PrismaService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('jwt.secret') || 'secret',
        });
    }

    async validate(payload: any) {
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
            include: {
                supportProfile: {
                    select: { adminUser: { select: { role: true, status: true, tenantId: true } } },
                },
            },
        });
        if (!user || user.status !== UserStatus.ACTIVE) {
            throw new UnauthorizedException();
        }
        return {
            id: user.id,
            email: user.email,
            role: user.role,
            tenantId: user.tenantId,
            platformSupport: user.role === Role.SUPPORT && user.tenantId === null &&
                user.supportProfile?.adminUser.role === Role.SUPER_ADMIN &&
                user.supportProfile.adminUser.status === UserStatus.ACTIVE &&
                user.supportProfile.adminUser.tenantId === null,
            monitoringEnabled: user.monitoringEnabled,
            impersonation: payload.impersonation,
        };
    }
}
