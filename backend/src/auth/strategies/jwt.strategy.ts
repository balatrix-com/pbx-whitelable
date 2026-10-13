import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { UserStatus } from '@prisma/client';

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
        const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
        if (!user || user.status !== UserStatus.ACTIVE) {
            throw new UnauthorizedException();
        }
        return {
            id: user.id,
            email: user.email,
            role: user.role,
            tenantId: user.tenantId,
            monitoringEnabled: user.monitoringEnabled,
            impersonation: payload.impersonation,
        };
    }
}
