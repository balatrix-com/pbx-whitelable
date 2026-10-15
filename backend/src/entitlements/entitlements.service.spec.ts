import { ConflictException } from '@nestjs/common';
import { of } from 'rxjs';
import { EntitlementsService } from './entitlements.service';

describe('EntitlementsService', () => {
    const subscription = {
        subBillingSubscriptionId: 'SUB-A',
        tenant: { subBillingCustomerId: 'CUST-A' },
    };
    const prisma: any = {
        subscription: { findMany: jest.fn().mockResolvedValue([subscription]) },
        $transaction: jest.fn((work: any) => work(prisma)),
        $queryRaw: jest.fn().mockResolvedValue([{ id: 'tenant-a' }]),
        extension: { count: jest.fn().mockResolvedValue(2) },
        tFN: { count: jest.fn().mockResolvedValue(1) },
        dID: { count: jest.fn().mockResolvedValue(0) },
    };
    const http: any = { get: jest.fn().mockReturnValue(of({ data: {
        subscriptionId: 'SUB-A', customerId: 'CUST-A',
        allowed: { extensions: 2, tfns: 1, dids: 0 },
    } })) };
    const config: any = { get: jest.fn().mockReturnValue('http://127.0.0.1:5005/api') };
    const service = new EntitlementsService(prisma, http, config);

    it('rejects a third extension and a second TFN before mutation', async () => {
        const mutation = jest.fn();
        await expect(service.withAvailableSlot('tenant-a', 'extensions', mutation)).rejects.toThrow(ConflictException);
        await expect(service.withAvailableSlot('tenant-a', 'tfns', mutation)).rejects.toThrow(ConflictException);
        expect(mutation).not.toHaveBeenCalled();
    });

    it('rejects ambiguous active subscription mapping', async () => {
        prisma.subscription.findMany.mockResolvedValueOnce([subscription, subscription]);
        await expect(service.allowance('tenant-a')).rejects.toThrow(ConflictException);
    });
});
