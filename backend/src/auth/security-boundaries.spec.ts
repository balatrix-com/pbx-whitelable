import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

describe('Authentication access boundaries', () => {
    const prisma = { user: { findUnique: jest.fn() }, $transaction: jest.fn() };
    const service = new AuthService(prisma as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    beforeEach(() => jest.clearAllMocks());
    it('rejects signup without creating records or tokens', async () => {
        expect(() => new AuthController(service).signup()).toThrow(NotFoundException);
        await expect(service.signup({ email: 'test@example.invalid', password: 'dummy', companyName: 'Test' })).rejects.toThrow(NotFoundException);
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });
    it.each(['SUSPENDED', 'DELETED', 'INVITED'])('rejects login and refresh for %s users', async status => {
        prisma.user.findUnique.mockResolvedValue({ id: 'user', status, password: 'hash', refreshToken: 'hash' });
        expect(await service.validateUser('test@example.invalid', 'dummy')).toBeNull();
        await expect(service.refreshTokens('user', 'dummy')).rejects.toThrow(UnauthorizedException);
    });
    it('rejects existing tokens after suspension', async () => {
        const strategy = new JwtStrategy({ get: () => 'test-only-secret' } as any, prisma as any);
        prisma.user.findUnique.mockResolvedValue({ status: 'SUSPENDED' });
        await expect(strategy.validate({ sub: 'user' })).rejects.toThrow(UnauthorizedException);
    });
    it('uses current database role and tenant', async () => {
        const strategy = new JwtStrategy({ get: () => 'test-only-secret' } as any, prisma as any);
        prisma.user.findUnique.mockResolvedValue({ id: 'user', status: 'ACTIVE', role: 'SUPPORT', tenantId: 'tenant' });
        expect(await strategy.validate({ sub: 'user', role: 'SUPER_ADMIN', tenantId: 'other' })).toMatchObject({ role: 'SUPPORT', tenantId: 'tenant' });
    });
});
