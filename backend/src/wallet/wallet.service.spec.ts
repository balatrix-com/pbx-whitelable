import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from './wallet.service';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { NotificationsService } from '../notifications/notifications.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { FreeSwitchSyncService } from '../freeswitch/freeswitch-sync.service';
import { LookupRedisService } from '../redis/lookup-redis.module';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { of } from 'rxjs';

describe('WalletService (switchSubscriptionPlan & Kamailio Sync)', () => {
    let service: WalletService;
    let prisma: any;
    let freeSwitchSync: any;
    let lookupRedis: any;
    let httpService: any;

    beforeEach(async () => {
        prisma = {
            tenant: {
                findUnique: jest.fn().mockResolvedValue({ id: 'U1010', customerCode: '1010', subBillingCustomerId: 'U1010' }),
            },
            plan: {
                findFirst: jest.fn().mockResolvedValue({ id: 'plan-starter-uuid', name: 'Starter' }),
            },
            subscription: {
                findFirst: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({ id: 'sub-local-1' }),
                update: jest.fn().mockResolvedValue({ id: 'sub-updated-1' }),
            },
            extension: {
                count: jest.fn().mockResolvedValue(0),
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: `ext-uuid-${data.extensionNumber}`, ...data })),
            },
        };

        freeSwitchSync = {
            syncExtension: jest.fn().mockResolvedValue(undefined),
        };

        lookupRedis = {
            updateExtensionLookup: jest.fn().mockResolvedValue(undefined),
        };

        httpService = {
            post: jest.fn().mockReturnValue(
                of({
                    data: {
                        success: true,
                        data: {
                            subscription_id: 'sub-uuid-1',
                            plan_id: 'tier_1_starter',
                            extensions: 5,
                            free_minutes: 100
                        }
                    }
                })
            ),
            get: jest.fn().mockReturnValue(
                of({
                    data: {
                        success: true,
                        data: {
                            plan_id: 'tier_1_starter',
                            extensions: 5,
                            free_minutes: 100
                        }
                    }
                })
            )
        };

        const configService = {
            get: jest.fn().mockReturnValue('http://localhost:5005/api'),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WalletService,
                { provide: PrismaService, useValue: prisma },
                { provide: BillingService, useValue: {} },
                { provide: NotificationsService, useValue: {} },
                { provide: HttpService, useValue: httpService },
                { provide: ConfigService, useValue: configService },
                { provide: FreeSwitchSyncService, useValue: freeSwitchSync },
                { provide: LookupRedisService, useValue: lookupRedis },
            ],
        }).compile();

        service = module.get<WalletService>(WalletService);
    });

    describe('switchSubscriptionPlan', () => {
        it('should call sub-billing switch-plan with execute_on_expiration: true and NOT update local Prisma when tenant already has active subscription', async () => {
            prisma.subscription.findFirst.mockResolvedValueOnce({
                id: 'existing-sub-id',
                planId: 'old-plan-id',
                status: 'ACTIVE'
            });

            const res = await service.switchSubscriptionPlan('U1010', 'tier_1_starter', false);

            expect(res.success).toBe(true);

            // Sub-billing switch-plan call with execute_on_expiration: true
            expect(httpService.post).toHaveBeenCalledWith(
                'http://localhost:5005/api/subscriptions/switch-plan',
                expect.objectContaining({
                    customer_id: 'U1010',
                    target_plan_id: 'tier_1_starter',
                    execute_on_expiration: true,
                    override_balance_check: true,
                })
            );

            // Local Prisma subscription was NOT updated prematurely
            expect(prisma.subscription.update).not.toHaveBeenCalled();
        });

        it('should activate immediately for planless tenant (initial activation)', async () => {
            prisma.subscription.findFirst.mockResolvedValueOnce(null);

            const res = await service.switchSubscriptionPlan('U1010', 'tier_1_starter', true);

            expect(res.success).toBe(true);

            expect(prisma.subscription.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        tenantId: 'U1010',
                        status: 'ACTIVE',
                    })
                })
            );
        });
    });

    describe('cancelScheduledPlanSwitch', () => {
        it('should call sub-billing cancel-switch with customer_id', async () => {
            httpService.post.mockReturnValueOnce(of({
                data: { success: true, message: 'Scheduled plan switch cancelled' }
            }));

            const res = await service.cancelScheduledPlanSwitch('U1010');

            expect(res.success).toBe(true);
            expect(httpService.post).toHaveBeenCalledWith(
                'http://localhost:5005/api/subscriptions/cancel-switch',
                {
                    customer_id: 'U1010'
                }
            );
        });

        it('should reject cancelScheduledPlanSwitch if tenant is ARCHIVED', async () => {
            prisma.tenant.findUnique.mockResolvedValueOnce({
                id: 'U1010',
                name: 'Archived Tenant',
                status: 'ARCHIVED',
                subBillingCustomerId: 'U1010'
            });

            await expect(service.cancelScheduledPlanSwitch('U1010')).rejects.toThrow(BadRequestException);
        });
    });

    describe('assertActiveTenant', () => {
        it('should throw NotFoundException if tenant does not exist', async () => {
            prisma.tenant.findUnique.mockResolvedValueOnce(null);
            await expect(service.assertActiveTenant('NON_EXISTENT')).rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException if tenant status is ARCHIVED', async () => {
            prisma.tenant.findUnique.mockResolvedValueOnce({
                id: 'ARCH_1',
                name: 'Old Company',
                status: 'ARCHIVED',
                subBillingCustomerId: 'CUST_1'
            });
            await expect(service.assertActiveTenant('ARCH_1')).rejects.toThrow(
                /Cannot perform operation on deactivated\/archived tenant/
            );
        });

        it('should throw BadRequestException if tenant has no subBillingCustomerId', async () => {
            prisma.tenant.findUnique.mockResolvedValueOnce({
                id: 'ACTIVE_1',
                name: 'New Company',
                status: 'ACTIVE',
                subBillingCustomerId: null
            });
            await expect(service.assertActiveTenant('ACTIVE_1')).rejects.toThrow(
                /Tenant not linked to a billing system customer/
            );
        });

        it('should return tenant record if active and linked', async () => {
            const activeRecord = {
                id: 'ACTIVE_1',
                name: 'Healthy Company',
                status: 'ACTIVE',
                subBillingCustomerId: 'CUST_1'
            };
            prisma.tenant.findUnique.mockResolvedValueOnce(activeRecord);
            const result = await service.assertActiveTenant('ACTIVE_1');
            expect(result).toEqual(activeRecord);
        });
    });

    describe('Wallet Operations on Archived Tenants', () => {
        beforeEach(() => {
            prisma.tenant.findUnique.mockResolvedValue({
                id: 'ARCHIVED_TENANT',
                name: 'Deactivated Org',
                status: 'ARCHIVED',
                subBillingCustomerId: 'CUST_ARCHIVED'
            });
        });

        it('adjustBalance should throw BadRequestException for archived tenant', async () => {
            await expect(
                service.adjustBalance('ARCHIVED_TENANT', 100, 'CREDIT' as any, 'Manual adjustment')
            ).rejects.toThrow(BadRequestException);
            expect(httpService.post).not.toHaveBeenCalled();
        });

        it('topUpWallet should throw BadRequestException for archived tenant', async () => {
            await expect(
                service.topUpWallet('ARCHIVED_TENANT', 50)
            ).rejects.toThrow(BadRequestException);
            expect(httpService.post).not.toHaveBeenCalled();
        });

        it('updateCreditLimit should throw BadRequestException for archived tenant', async () => {
            await expect(
                service.updateCreditLimit('ARCHIVED_TENANT', 500)
            ).rejects.toThrow(BadRequestException);
        });

        it('switchSubscriptionPlan should throw BadRequestException for archived tenant', async () => {
            await expect(
                service.switchSubscriptionPlan('ARCHIVED_TENANT', 'tier_1_starter', false)
            ).rejects.toThrow(BadRequestException);
            expect(httpService.post).not.toHaveBeenCalled();
        });

        it('toggleSubscriptionAutoRenew should throw BadRequestException for archived tenant', async () => {
            await expect(
                service.toggleSubscriptionAutoRenew('ARCHIVED_TENANT', false)
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('Wallet Operations on Active Tenants', () => {
        it('adjustBalance should successfully call sub-billing manual payment for active tenant', async () => {
            prisma.tenant.findUnique.mockResolvedValueOnce({
                id: 'U1010',
                name: 'Active Tenant',
                status: 'ACTIVE',
                subBillingCustomerId: 'U1010'
            });

            httpService.post.mockReturnValueOnce(of({
                data: { success: true, message: 'Payment recorded' }
            }));

            const res = await service.adjustBalance('U1010', 25, 'CREDIT' as any, 'Goodwill credit');
            expect(res.success).toBe(true);
            expect(httpService.post).toHaveBeenCalledWith(
                'http://localhost:5005/api/payments/manual',
                expect.objectContaining({
                    customer_id: 'U1010',
                    amount: 25,
                    payment_type: 'pbx_admin_adjust',
                })
            );
        });
    });
});
