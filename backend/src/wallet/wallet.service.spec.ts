import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from './wallet.service';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
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

    describe('getAllSubscriptions', () => {
        const mockTenants = [
            {
                id: 'T1',
                name: 'Acme Telecom',
                customerCode: '1001',
                subBillingCustomerId: 'CUST_1',
                status: 'ACTIVE',
                serviceBlocked: false,
                createdAt: new Date('2026-01-01'),
                users: [{ email: 'admin@acme.com' }]
            },
            {
                id: 'T2',
                name: 'Beta Logistics',
                customerCode: '1002',
                subBillingCustomerId: 'CUST_2',
                status: 'ACTIVE',
                serviceBlocked: false,
                createdAt: new Date('2026-01-02'),
                users: [{ email: 'admin@beta.com' }]
            },
            {
                id: 'T3',
                name: 'Gamma Corp',
                customerCode: '1003',
                subBillingCustomerId: 'CUST_3',
                status: 'ARCHIVED',
                serviceBlocked: false,
                createdAt: new Date('2026-01-03'),
                users: [{ email: 'admin@gamma.com' }]
            },
            {
                id: 'T4',
                name: 'Delta Unlinked',
                customerCode: '1004',
                subBillingCustomerId: null,
                status: 'ACTIVE',
                serviceBlocked: false,
                createdAt: new Date('2026-01-04'),
                users: []
            }
        ];

        const mockSubBillingSubs = [
            {
                id: 'sub-uuid-1',
                subscription_id: 'SUB-101',
                customer_id: 'CUST_1',
                status: 'active',
                plan_id: 'plan-enterprise',
                plan_name: 'Enterprise Plan',
                amount: 99.00,
                currency: 'USD',
                start_date: '2026-01-01T00:00:00Z',
                next_billing: '2026-02-01T00:00:00Z',
                auto_renew: true,
                target_plan_id: 'plan-unlimited',
                target_plan_name: 'Unlimited Plan',
                target_plan_amount: 149.00,
                scheduled_switch_at: '2026-02-01T00:00:00Z',
                active_addons_count: 3,
                limits: { extensions: 20, free_mins: 1000 }
            },
            {
                id: 'sub-uuid-3',
                subscription_id: 'SUB-103',
                customer_id: 'CUST_3',
                status: 'active',
                plan_id: 'plan-basic',
                plan_name: 'Basic Plan',
                amount: 15.00,
                currency: 'USD',
                start_date: '2026-01-01T00:00:00Z',
                next_billing: '2026-02-01T00:00:00Z',
                auto_renew: false,
                target_plan_id: null,
                target_plan_name: null,
                target_plan_amount: null,
                scheduled_switch_at: null,
                active_addons_count: 0,
                limits: { extensions: 5, free_mins: 200 }
            }
        ];

        const mockSubBillingBalances = [
            { customer_id: 'CUST_1', balance: 250.00, freeMins: 800, currency: 'USD' },
            { customer_id: 'CUST_2', balance: 50.00, freeMins: 0, currency: 'USD' },
            { customer_id: 'CUST_3', balance: 0.00, freeMins: 0, currency: 'USD' }
        ];

        beforeEach(() => {
            prisma.tenant.findMany = jest.fn().mockResolvedValue(mockTenants);
            httpService.get = jest.fn().mockImplementation((url: string) => {
                if (url.includes('/pbx/subscriptions/all')) {
                    return of({ data: mockSubBillingSubs });
                }
                if (url.includes('/pbx/all')) {
                    return of({ data: mockSubBillingBalances });
                }
                return of({ data: null });
            });
        });

        it('should correctly enrich subscribed, planless, archived, and unlinked tenants', async () => {
            const result = await service.getAllSubscriptions();
            expect(result.data).toHaveLength(4);
            expect(result.pagination.total).toBe(4);

            // Subscribed tenant T1
            const t1 = result.data.find(t => t.tenantId === 'T1');
            expect(t1).toBeDefined();
            expect(t1.hasSubscription).toBe(true);
            expect(t1.subscription.plan_name).toBe('Enterprise Plan');
            expect(t1.subscription.target_plan_name).toBe('Unlimited Plan');
            expect(t1.subscription.target_plan_amount).toBe(149.00);
            expect(t1.subscription.active_addons_count).toBe(3);
            expect(t1.subscription.limits.extensions).toBe(20);
            expect(t1.wallet.balance).toBe(250.00);
            expect(t1.adminEmail).toBe('admin@acme.com');

            // Planless tenant T2
            const t2 = result.data.find(t => t.tenantId === 'T2');
            expect(t2.hasSubscription).toBe(false);
            expect(t2.subscription).toBeNull();
            expect(t2.wallet.balance).toBe(50.00);

            // Archived tenant T3
            const t3 = result.data.find(t => t.tenantId === 'T3');
            expect(t3.tenantStatus).toBe('ARCHIVED');
            expect(t3.hasSubscription).toBe(true);
            expect(t3.subscription.plan_name).toBe('Basic Plan');

            // Unlinked tenant T4
            const t4 = result.data.find(t => t.tenantId === 'T4');
            expect(t4.hasSubscription).toBe(false);
            expect(t4.subscription).toBeNull();
            expect(t4.adminEmail).toBeNull();
            expect(t4.wallet.balance).toBe(0);
        });

        it('should filter by tenant status', async () => {
            const archivedOnly = await service.getAllSubscriptions({ status: 'ARCHIVED' });
            expect(archivedOnly.data).toHaveLength(1);
            expect(archivedOnly.data[0].tenantId).toBe('T3');

            const activeOnly = await service.getAllSubscriptions({ status: 'ACTIVE' });
            expect(activeOnly.data).toHaveLength(3);
            expect(activeOnly.data.every(t => t.tenantStatus === 'ACTIVE')).toBe(true);
        });

        it('should filter by hasSubscription flag', async () => {
            const subscribedOnly = await service.getAllSubscriptions({ hasSubscription: true });
            expect(subscribedOnly.data).toHaveLength(2);
            expect(subscribedOnly.data.map(t => t.tenantId).sort()).toEqual(['T1', 'T3']);

            const planlessOnly = await service.getAllSubscriptions({ hasSubscription: false });
            expect(planlessOnly.data).toHaveLength(2);
            expect(planlessOnly.data.map(t => t.tenantId).sort()).toEqual(['T2', 'T4']);
        });

        it('should filter by search query across tenant name, code, email, and plan name', async () => {
            // By tenant name
            const searchName = await service.getAllSubscriptions({ search: 'acme' });
            expect(searchName.data).toHaveLength(1);
            expect(searchName.data[0].tenantId).toBe('T1');

            // By customer code
            const searchCode = await service.getAllSubscriptions({ search: '1002' });
            expect(searchCode.data).toHaveLength(1);
            expect(searchCode.data[0].tenantId).toBe('T2');

            // By admin email
            const searchEmail = await service.getAllSubscriptions({ search: 'admin@gamma.com' });
            expect(searchEmail.data).toHaveLength(1);
            expect(searchEmail.data[0].tenantId).toBe('T3');

            // By plan name
            const searchPlan = await service.getAllSubscriptions({ search: 'enterprise' });
            expect(searchPlan.data).toHaveLength(1);
            expect(searchPlan.data[0].tenantId).toBe('T1');

            // Non-matching search
            const searchNone = await service.getAllSubscriptions({ search: 'xyznonexistent' });
            expect(searchNone.data).toHaveLength(0);
            expect(searchNone.pagination.total).toBe(0);
        });

        it('should support pagination correctly', async () => {
            const page1 = await service.getAllSubscriptions({ page: 1, limit: 2 });
            expect(page1.data).toHaveLength(2);
            expect(page1.pagination.page).toBe(1);
            expect(page1.pagination.limit).toBe(2);
            expect(page1.pagination.total).toBe(4);
            expect(page1.pagination.totalPages).toBe(2);

            const page2 = await service.getAllSubscriptions({ page: 2, limit: 2 });
            expect(page2.data).toHaveLength(2);
            expect(page2.pagination.page).toBe(2);
            expect(page2.data[0].tenantId).not.toEqual(page1.data[0].tenantId);
        });

        it('should handle Sub-Billing API failures gracefully without throwing', async () => {
            httpService.get = jest.fn().mockImplementation(() => {
                throw new Error('Connection timeout');
            });

            const result = await service.getAllSubscriptions();
            expect(result.data).toHaveLength(4);
            expect(result.data.every(t => t.hasSubscription === false)).toBe(true);
            expect(result.data.every(t => t.wallet.balance === 0)).toBe(true);
        });

        it('should catch database errors gracefully', async () => {
            prisma.tenant.findMany = jest.fn().mockRejectedValue(new Error('DB connection closed'));

            const result = await service.getAllSubscriptions();
            expect(result.data).toEqual([]);
            expect(result.pagination.total).toBe(0);
        });
    });
});
