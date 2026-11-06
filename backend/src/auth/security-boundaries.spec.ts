import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

describe('Authentication access boundaries', () => {
    const prisma = { user: { findUnique: jest.fn() }, $transaction: jest.fn() };
    const service = new AuthService(prisma as any, {} as any, {} as any, {} as any, {} as any);
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

    it.each([
        { tenantId: 'tenant-a', creatorRole: 'SUPER_ADMIN', creatorTenant: null, creatorStatus: 'ACTIVE', expected: false },
        { tenantId: null, creatorRole: 'ADMIN', creatorTenant: 'tenant-a', creatorStatus: 'ACTIVE', expected: false },
        { tenantId: null, creatorRole: 'SUPER_ADMIN', creatorTenant: 'tenant-a', creatorStatus: 'ACTIVE', expected: false },
        { tenantId: null, creatorRole: 'SUPER_ADMIN', creatorTenant: null, creatorStatus: 'SUSPENDED', expected: false },
        { tenantId: null, creatorRole: 'SUPER_ADMIN', creatorTenant: null, creatorStatus: 'ACTIVE', expected: true },
    ])('derives platform support authority from current database state: %j', async fixture => {
        const strategy = new JwtStrategy({ get: () => 'test-only-secret' } as any, prisma as any);
        prisma.user.findUnique.mockResolvedValue({
            id: 'support', status: 'ACTIVE', role: 'SUPPORT', tenantId: fixture.tenantId,
            supportProfile: { adminUser: {
                role: fixture.creatorRole, status: fixture.creatorStatus, tenantId: fixture.creatorTenant,
            } },
        });
        expect(await strategy.validate({ sub: 'support', platformSupport: true }))
            .toMatchObject({ platformSupport: fixture.expected });
    });

    it('does not infer platform support from a missing tenant or a token claim alone', async () => {
        const strategy = new JwtStrategy({ get: () => 'test-only-secret' } as any, prisma as any);
        prisma.user.findUnique.mockResolvedValue({ id: 'support', status: 'ACTIVE', role: 'SUPPORT', tenantId: null });
        expect(await strategy.validate({ sub: 'support', platformSupport: true }))
            .toMatchObject({ platformSupport: false });
    });
});
