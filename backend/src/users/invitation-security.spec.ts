import { UsersService } from './users.service';
import { BadRequestException } from '@nestjs/common';

jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('dummy-hash') }));

describe('Single-use invitation acceptance', () => {
    const prisma = {
        user: { findUnique: jest.fn(), updateMany: jest.fn() },
        userAuditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new UsersService(prisma as any, {} as any, {} as any);
    beforeEach(() => {
        jest.clearAllMocks();
        prisma.user.findUnique.mockResolvedValue({ id: 'user', email: 'test@example.invalid', status: 'INVITED', inviteTokenExpiry: new Date(Date.now() + 60000) });
    });
    it('only accepts once when two requests race', async () => {
        prisma.user.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
        const results = await Promise.allSettled([service.acceptInvite('dummy-token', 'dummy-password'), service.acceptInvite('dummy-token', 'dummy-password')]);
        expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
        expect(prisma.userAuditLog.create).toHaveBeenCalledTimes(1);
        expect(prisma.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ inviteToken: 'dummy-token', status: 'INVITED', inviteTokenExpiry: { gt: expect.any(Date) } }),
            data: expect.objectContaining({ inviteToken: null, inviteTokenExpiry: null, status: 'ACTIVE' }),
        }));
    });
    it('rejects expired invitations before modifying a user', async () => {
        prisma.user.findUnique.mockResolvedValue({ status: 'INVITED', inviteTokenExpiry: new Date(0) });
        await expect(service.acceptInvite('dummy-token', 'dummy-password')).rejects.toThrow(BadRequestException);
        expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });
});
