import { BadRequestException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { WalletService } from '../src/wallet/wallet.service';

describe('WalletService - switchSubscriptionPlan & cancelScheduledPlanSwitch', () => {
    let service: WalletService;
    let mockPrisma: any;
    let mockBillingService: any;
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
            mockHttpService,
            mockConfigService,
            mockFreeSwitchSync,
            mockLookupRedis,
        );
    });

    describe('switchSubscriptionPlan', () => {
        it('should schedule switch for next billing cycle (immediate: false) and NOT alter local active subscription', async () => {
            // Mock sub-billing switch-plan response for scheduled switch
            mockHttpService.post.mockImplementation((url: string, body: any) => {
                if (url.includes('/subscriptions/switch-plan')) {
                    return of({
                        data: {
                            success: true,
                            message: 'Plan switch to target_rate_card_plan scheduled for cycle end.',
                            data: {
                                customer_id: 'U9999',
                                subscription_id: 'SUB-OLD',
                                current_plan_id: 'current_plan',
                                target_plan_id: 'target_rate_card_plan',
                                scheduled_switch_at: '2026-11-21T00:00:00.000Z'
                            }
                        }
                    });
                }
                return of({ data: {} });
            });

            // Tenant already has an active subscription
            mockPrisma.subscription.findFirst.mockResolvedValue({
                id: 'sub-existing',
                planId: 'current_plan',
                subBillingSubscriptionId: 'SUB-OLD',
                remainingFreeMinutes: 500
            });

            // Call with default (immediate = false)
            const result = await service.switchSubscriptionPlan('tenant-123', 'target_rate_card_plan');

            // Verify sub-billing called with execute_on_expiration: true (Next Billing Cycle)
            expect(mockHttpService.post).toHaveBeenCalledWith(
                'http://localhost:5005/api/subscriptions/switch-plan',
                expect.objectContaining({
                    customer_id: 'U9999',
                    target_plan_id: 'target_rate_card_plan',
                    execute_on_expiration: true,
                    override_balance_check: true
                })
            );

            // Verify local Prisma subscription was NOT updated (current plan remains active until renewal)
            expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
            expect(mockPrisma.subscription.create).not.toHaveBeenCalled();

            expect(result.data.target_plan_id).toBe('target_rate_card_plan');
            expect(result.data.scheduled_switch_at).toBe('2026-11-21T00:00:00.000Z');
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

            // Expect Prisma subscription.create to have been called for initial activation
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

        it('should throw BadRequestException if sub-billing returns error during plan switch', async () => {
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

    describe('cancelScheduledPlanSwitch', () => {
        it('should call sub-billing cancel-switch endpoint with customer_id', async () => {
            mockHttpService.post.mockReturnValue(of({
                data: {
                    success: true,
                    message: 'Scheduled plan switch to pro_plan cancelled successfully.',
                    data: {
                        customer_id: 'U9999',
                        subscription_id: 'SUB-123',
                        current_plan_id: 'starter_plan'
                    }
                }
            }));

            const result = await service.cancelScheduledPlanSwitch('tenant-123');

            expect(mockHttpService.post).toHaveBeenCalledWith(
                'http://localhost:5005/api/subscriptions/cancel-switch',
                {
                    customer_id: 'U9999'
                }
            );

            expect(result.success).toBe(true);
            expect(result.data.current_plan_id).toBe('starter_plan');
        });

        it('should throw BadRequestException if sub-billing returns error on cancel-switch', async () => {
            mockHttpService.post.mockReturnValue(
                throwError(() => ({
                    response: { data: { message: 'No scheduled plan switch found' } }
                }))
            );

            await expect(
                service.cancelScheduledPlanSwitch('tenant-123')
            ).rejects.toThrow(BadRequestException);
        });
    });
});
