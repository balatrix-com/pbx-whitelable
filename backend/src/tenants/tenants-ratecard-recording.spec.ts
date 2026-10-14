import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TenantsService } from './tenants.service';

describe('TenantsService - Rate Card & Recording Features', () => {
    let service: TenantsService;
    let mockPrisma: any;
    let mockFreeSwitchSync: any;
    let mockAdminService: any;
    let mockLookupRedis: any;
    let mockWalletService: any;
    let mockExtensionsService: any;
    let mockMailService: any;

    beforeEach(() => {
        mockPrisma = {
            tenant: {
                findUnique: jest.fn(),
                findMany: jest.fn().mockResolvedValue([]),
                create: jest.fn().mockImplementation((args) => Promise.resolve({ id: args.data.id || 't1', ...args.data })),
            },
            extension: {
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            tenantFeature: {
                upsert: jest.fn().mockResolvedValue({ recordingAllowed: true }),
            },
            recRateCard: {
                findUnique: jest.fn(),
            },
            plan: {
                findFirst: jest.fn(),
            },
            user: {
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({ id: 'u1', email: 'test@admin.com', role: 'ADMIN' }),
            },
            wallet: {
                create: jest.fn().mockResolvedValue({}),
            },
            monitoringAddOn: {
                create: jest.fn().mockResolvedValue({}),
            },
            subscription: {
                create: jest.fn().mockResolvedValue({}),
            },
            $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
        };

        mockFreeSwitchSync = {
            syncAllDialplans: jest.fn().mockResolvedValue(true),
        };
        mockAdminService = {
            updateCustomerRecRateCardMapping: jest.fn().mockResolvedValue({ success: true }),
            updateCustomerRateCardMapping: jest.fn().mockResolvedValue({ success: true }),
        };
        mockLookupRedis = {
            updateExtensionLookup: jest.fn().mockResolvedValue(true),
        };
        mockWalletService = {
            getSubBillingPlan: jest.fn(),
            createSubBillingCustomerExtended: jest.fn(),
            createSubBillingSubscription: jest.fn(),
            checkCustomerExists: jest.fn().mockResolvedValue(false),
            deleteSubBillingCustomer: jest.fn().mockResolvedValue(undefined),
        };
        mockExtensionsService = {
            syncMissingExtensionsFromSubBilling: jest.fn().mockResolvedValue(true),
        };
        mockMailService = {
            sendOnboardingCompletionEmail: jest.fn().mockResolvedValue(true),
        };

        service = new TenantsService(
            mockPrisma,
            mockFreeSwitchSync,
            mockAdminService,
            mockLookupRedis,
            mockWalletService,
            mockExtensionsService,
            mockMailService,
        );
    });

    describe('updateTenantFeatures - Recording Guard', () => {
        it('should throw NotFoundException if tenant does not exist', async () => {
            mockPrisma.tenant.findUnique.mockResolvedValue(null);
            await expect(
                service.updateTenantFeatures('non-existent', { recordingAllowed: true, recRateCardId: 1 }),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException if recordingAllowed is true but recRateCardId is missing', async () => {
            mockPrisma.tenant.findUnique.mockResolvedValue({ id: 't1', customerCode: 'U1001' });
            await expect(
                service.updateTenantFeatures('t1', { recordingAllowed: true }),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException if recRateCardId does not exist in recRateCard table', async () => {
            mockPrisma.tenant.findUnique.mockResolvedValue({ id: 't1', customerCode: 'U1001' });
            mockPrisma.recRateCard.findUnique.mockResolvedValue(null);

            await expect(
                service.updateTenantFeatures('t1', { recordingAllowed: true, recRateCardId: 999 }),
            ).rejects.toThrow(BadRequestException);
            expect(mockPrisma.recRateCard.findUnique).toHaveBeenCalledWith({ where: { id: 999 } });
        });

        it('should successfully map recording rate card and enable recording when recRateCardId is valid', async () => {
            mockPrisma.tenant.findUnique.mockResolvedValue({ id: 't1', customerCode: 'U1001' });
            mockPrisma.recRateCard.findUnique.mockResolvedValue({ id: 1, name: 'Standard Rec' });

            const result = await service.updateTenantFeatures('t1', {
                recordingAllowed: true,
                recRateCardId: 1,
            });

            expect(mockAdminService.updateCustomerRecRateCardMapping).toHaveBeenCalledWith('U1001', {
                rec_rc_id: 1,
            });
            expect(mockPrisma.tenantFeature.upsert).toHaveBeenCalled();
            expect(result.recordingAllowed).toBe(true);
        });

        it('should allow disabling recording without requiring recRateCardId', async () => {
            mockPrisma.tenant.findUnique.mockResolvedValue({ id: 't1', customerCode: 'U1001' });
            mockPrisma.tenantFeature.upsert.mockResolvedValue({ recordingAllowed: false });

            const result = await service.updateTenantFeatures('t1', { recordingAllowed: false });

            expect(mockAdminService.updateCustomerRecRateCardMapping).not.toHaveBeenCalled();
            expect(result.recordingAllowed).toBe(false);
        });
    });

    describe('createTenant - Rate Card Auto-Assignment', () => {
        const tenantInput = {
            customerType: 'individual' as const,
            firstName: 'John',
            lastName: 'Doe',
            adminEmail: 'john@doe.com',
            adminPassword: 'Password123!',
            phone: '+1234567890',
            address: '123 Main Street Suite 100',
            city: 'New York',
            state: 'NY',
            country: 'USA',
        };

        it('should pass plan rate card to sub-billing customer creation and map rate card', async () => {
            mockWalletService.getSubBillingPlan.mockResolvedValue({
                plan_id: 'test_rate_card_plan',
                rate_card_id: '1',
                free_mins: 100,
            });
            mockPrisma.plan.findFirst.mockResolvedValue({
                id: 'local_p1',
                freeMinutes: 100,
            });
            mockWalletService.createSubBillingCustomerExtended.mockResolvedValue({
                customer_id: 'U1001',
            });
            mockWalletService.createSubBillingSubscription.mockResolvedValue({
                subscription_id: 'SUB-1234',
            });

            const result = await service.createTenant({
                ...tenantInput,
                planId: 'test_rate_card_plan',
            });

            expect(mockWalletService.getSubBillingPlan).toHaveBeenCalledWith('test_rate_card_plan');
            // Customer extended should receive ratecardId: 1
            expect(mockWalletService.createSubBillingCustomerExtended).toHaveBeenCalledWith(
                expect.objectContaining({
                    ratecardId: 1,
                }),
            );
            // Explicit rate card mapping update
            expect(mockAdminService.updateCustomerRateCardMapping).toHaveBeenCalledWith({
                customer_id: 'U1001',
                ratecard_id: 1,
            });
            // Subscription created with override balance check
            expect(mockWalletService.createSubBillingSubscription).toHaveBeenCalledWith(
                'U1001',
                'test_rate_card_plan',
                true,
            );
            expect(result.tenant).toBeDefined();
            expect(result.user).toBeDefined();
        });

        it('should create tenant normally even when no planId is provided', async () => {
            mockWalletService.createSubBillingCustomerExtended.mockResolvedValue({
                customer_id: 'U1002',
            });

            const result = await service.createTenant(tenantInput);

            expect(mockWalletService.getSubBillingPlan).not.toHaveBeenCalled();
            expect(mockWalletService.createSubBillingCustomerExtended).toHaveBeenCalledWith(
                expect.objectContaining({
                    ratecardId: undefined,
                }),
            );
            expect(mockAdminService.updateCustomerRateCardMapping).not.toHaveBeenCalled();
            expect(result.tenant).toBeDefined();
        });
    });
});
