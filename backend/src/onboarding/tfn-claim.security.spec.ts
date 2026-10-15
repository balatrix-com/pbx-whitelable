import { BadRequestException } from '@nestjs/common';
import { TFNStatus } from '@prisma/client';
import { OnboardingService } from './onboarding.service';

describe('Atomic TFN claim', () => {
    it('lets only one of two tenants claim the same available TFN', async () => {
        let owner: string | null = null;
        const prisma: any = {
            tFN: {
                updateMany: jest.fn(async ({ where, data }: any) => {
                    await Promise.resolve();
                    if (owner !== null || where.status !== TFNStatus.AVAILABLE || where.tenantId !== null) {
                        return { count: 0 };
                    }
                    owner = data.tenantId;
                    return { count: 1 };
                }),
                findUnique: jest.fn(async () => ({ id: 'tfn-1', number: '+18005550123', tenantId: owner })),
                findUniqueOrThrow: jest.fn(async () => ({ id: 'tfn-1', number: '+18005550123', tenantId: owner })),
            },
        };
        const freeswitch = { syncTFN: jest.fn().mockResolvedValue(undefined) };
        const redis = { updateNumberLookup: jest.fn().mockResolvedValue(undefined) };
        const entitlements = { withAvailableSlot: jest.fn((_tenantId: any, _resource: any, action: any) => action(prisma)) };
        const service = new OnboardingService(prisma, {} as any, {} as any, {} as any,
            {} as any, {} as any, freeswitch as any, {} as any, {} as any,
            redis as any, {} as any, {} as any, entitlements as any);
        jest.spyOn(service, 'getOnboardingStatus').mockResolvedValue({ needsTfn: true } as any);
        jest.spyOn(service as any, 'syncAssetsToSubBilling').mockResolvedValue(undefined);

        const results = await Promise.allSettled([
            service.selectTfnForAuthenticatedUser('tenant-a', 'tfn-1'),
            service.selectTfnForAuthenticatedUser('tenant-b', 'tfn-1'),
        ]);
        expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        const loser = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
        expect(loser.reason).toBeInstanceOf(BadRequestException);
        expect(prisma.tFN.updateMany).toHaveBeenCalledWith({
            where: { id: 'tfn-1', tenantId: null, status: TFNStatus.AVAILABLE },
            data: expect.objectContaining({ status: TFNStatus.ASSIGNED }),
        });
        expect(freeswitch.syncTFN).toHaveBeenCalledTimes(1);
        expect(redis.updateNumberLookup).toHaveBeenCalledTimes(1);
        expect(redis.updateNumberLookup).toHaveBeenCalledWith('+18005550123', owner);
    });
});
