import { BadRequestException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { WalletService } from '../src/wallet/wallet.service';

describe('WalletService - switchSubscriptionPlan', () => {
    let service: WalletService;
    let mockPrisma: any;
    let mockBillingService: any;
    let mockNotificationsService: any;
    let mockHttpService: any;
    let mockConfigService: any;
    let mockFreeSwitchSync: any;
    let mockLookupRedis: any;

    beforeEach(() => {
        mockPrisma = {
            tenant: {
                findUnique: jest.fn().mockResolvedValue({ id: 'tenant-123', subBillingCustomerId: 'U9999' }),
            },
            plan: {
                findFirst: jest.fn().mockResolvedValue({ id: 'local-plan-1', name: 'Pro Plan', freeMinutes: 200, maxExtensions: 10 }),
            },
            subscription: {
                findFirst: jest.fn(),
                create: jest.fn().mockResolvedValue({ id: 'sub-new', status: 'ACTIVE' }),
                update: jest.fn().mockResolvedValue({ id: 'sub-updated', status: 'ACTIVE' }),
            },
        };

        mockBillingService = {};
        mockNotificationsService = {};
        mockHttpService = {
            post: jest.fn(),
            get: jest.fn(),
        };
        mockConfigService = {
            get: jest.fn().mockReturnValue('http://localhost:5005/api'),
        };
        mockFreeSwitchSync = {};
        mockLookupRedis = {};

        service = new WalletService(
            mockPrisma,
            mockBillingService,
            mockNotificationsService,
            mockHttpService,
            mockConfigService,
            mockFreeSwitchSync,
            mockLookupRedis,
        );
    });

    it('should send override_balance_check: true and execute immediate switch', async () => {
        // Mock sub-billing switch-plan response
        mockHttpService.post.mockImplementation((url: string, body: any) => {
            if (url.includes('/subscriptions/switch-plan')) {
                return of({
                    data: {
                        success: true,
                        data: { subscription_id: 'SUB-999', plan_id: 'test_rate_card_plan' }
                    }
                });
            }
            if (url.includes('/rate-cards/mappings')) {
                return of({ data: { success: true } });
            }
            return of({ data: {} });
        });

        // Mock plan info retrieval
        mockHttpService.get.mockImplementation((url: string) => {
            if (url.includes('/plans/test_rate_card_plan')) {
                return of({
                    data: {
                        data: {
                            plan_id: 'test_rate_card_plan',
                            rate_card_id: 1,
                            extensions: 10,
                            free_mins: 200
                        }
                    }
                });
            }
            return of({ data: {} });
        });

        // Tenant already has an active subscription
        mockPrisma.subscription.findFirst.mockResolvedValue({
            id: 'sub-existing',
            subBillingSubscriptionId: 'SUB-OLD'
        });

        const result = await service.switchSubscriptionPlan('tenant-123', 'test_rate_card_plan', true);

        // Verify switch-plan request payload contains override_balance_check: true
        expect(mockHttpService.post).toHaveBeenCalledWith(
            'http://localhost:5005/api/subscriptions/switch-plan',
            expect.objectContaining({
                customer_id: 'U9999',
                target_plan_id: 'test_rate_card_plan',
                execute_on_expiration: false,
                override_balance_check: true
            })
        );

        // Verify rate card mapping was explicitly synced
        expect(mockHttpService.post).toHaveBeenCalledWith(
            'http://localhost:5005/api/rate-cards/mappings',
            {
                customer_id: 'U9999',
                ratecard_id: 1
            }
        );

        // Verify Prisma subscription updated
        expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'sub-existing' },
                data: expect.objectContaining({
                    status: 'ACTIVE',
                    subBillingSubscriptionId: 'SUB-999'
                })
            })
        );

        expect(result).toBeDefined();
    });

    it('should create initial subscription record in local Prisma if tenant has no active plan (planless tenant)', async () => {
        mockHttpService.post.mockImplementation((url: string) => {
            if (url.includes('/subscriptions/switch-plan')) {
                return of({
                    data: {
                        success: true,
                        data: { subscription_id: 'SUB-INITIAL-001', plan_id: 'basic_plan' }
                    }
                });
            }
            return of({ data: { success: true } });
        });

        mockHttpService.get.mockReturnValue(of({
            data: {
                data: {
                    plan_id: 'basic_plan',
                    rate_card_id: 1,
                    extensions: 5,
                    free_mins: 100
                }
            }
        }));

        // No existing subscription found for tenant
        mockPrisma.subscription.findFirst.mockResolvedValue(null);

        const result = await service.switchSubscriptionPlan('tenant-123', 'basic_plan', true);

        // Expect Prisma subscription.create to have been called
        expect(mockPrisma.subscription.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    tenantId: 'tenant-123',
                    subBillingSubscriptionId: 'SUB-INITIAL-001',
                    status: 'ACTIVE'
                })
            })
        );

        expect(result.data.subscription_id).toBe('SUB-INITIAL-001');
    });

    it('should throw BadRequestException if sub-billing returns error', async () => {
        mockHttpService.post.mockReturnValue(
            throwError(() => ({
                response: { data: { message: 'Customer not found' } }
            }))
        );

        await expect(
            service.switchSubscriptionPlan('tenant-123', 'invalid-plan')
        ).rejects.toThrow(BadRequestException);
    });
});
