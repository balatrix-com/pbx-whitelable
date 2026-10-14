import { ForbiddenException } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { UsersService } from './users.service';

describe('Support account scope', () => {
    let prisma: any;
    let service: UsersService;
    beforeEach(() => {
        prisma = {
            user: { findUnique: jest.fn(), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
            userAuditLog: { create: jest.fn().mockResolvedValue({}) },
        };
        service = new UsersService(prisma, {} as any, { sendSupportInvitationEmail: jest.fn().mockResolvedValue(undefined) } as any);
    });

    it.each([Role.ADMIN, Role.SUPPORT])('does not let tenantless %s create platform support', async role => {
        prisma.user.findUnique.mockResolvedValue({ id: 'actor', role, tenantId: null });
        await expect(service.inviteSupportUser('actor', { email: 'support@example.invalid' })).rejects.toThrow(ForbiddenException);
        await expect(service.createSupportUser('actor', { email: 'support@example.invalid', password: 'dummy-only' }))
            .rejects.toThrow(ForbiddenException);
        expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('binds an invited support user to the creating admin tenant, ignoring injected scope fields', async () => {
        prisma.user.findUnique.mockResolvedValueOnce({ id: 'admin-a', role: Role.ADMIN, tenantId: 'tenant-a' }).mockResolvedValueOnce(null);
        prisma.user.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'support-a', ...data }));
        await service.inviteSupportUser('admin-a', {
            email: 'support@example.invalid', tenantId: null, platformSupport: true, role: Role.SUPER_ADMIN,
        } as any);
        expect(prisma.user.create).toHaveBeenCalledWith({ data: expect.objectContaining({
            role: Role.SUPPORT, tenantId: 'tenant-a',
            supportProfile: { create: { adminUserId: 'admin-a', monitoringEnabled: false } },
        }) });
    });

    it('does not allow a tenantless admin to manage a platform user through null tenant equality', async () => {
        prisma.user.findUnique.mockResolvedValue({ id: 'admin', role: Role.ADMIN, tenantId: null });
        await expect(service.updateUserStatus('admin', 'platform-user', UserStatus.SUSPENDED)).rejects.toThrow(ForbiddenException);
        expect(prisma.user.update).not.toHaveBeenCalled();
    });
});
