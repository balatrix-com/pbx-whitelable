import { Test, TestingModule } from '@nestjs/testing';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { Role } from '@prisma/client';

describe('WalletController', () => {
  let controller: WalletController;
  let mockWalletService: any;

  beforeEach(async () => {
    mockWalletService = {
      adjustBalance: jest.fn().mockResolvedValue({ success: true }),
      updateCreditLimit: jest.fn().mockResolvedValue({ success: true }),
      switchSubscriptionPlan: jest.fn().mockResolvedValue({ success: true }),
      getBalance: jest.fn().mockResolvedValue({ balance: 100 }),
      getAllSubscriptions: jest.fn().mockResolvedValue({ data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 1 } }),
      getSubscription: jest.fn().mockResolvedValue({ id: 'sub-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletController],
      providers: [
        { provide: WalletService, useValue: mockWalletService }
      ]
    }).compile();

    controller = module.get<WalletController>(WalletController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('internalAdjust', () => {
    it('should delegate to walletService.adjustBalance', async () => {
      const superAdminUser = { id: 'admin1', email: 'admin@balatrix.com', role: Role.SUPER_ADMIN, tenantId: null } as any;
      const res = await controller.internalAdjust(superAdminUser, 'T_TARGET', 100, 'CREDIT' as any, 'Top up bonus');
      expect(res.success).toBe(true);
      expect(mockWalletService.adjustBalance).toHaveBeenCalledWith(
        'T_TARGET',
        100,
        'CREDIT',
        'Top up bonus',
        'MANUAL-ADJ-BY-admin@balatrix.com'
      );
    });

    it('should reject non-superadmin users', async () => {
      const regularUser = { id: 'user1', email: 'user@tenant.com', role: Role.ADMIN, tenantId: 'T1' } as any;
      await expect(
        controller.internalAdjust(regularUser, 'T1', 50, 'CREDIT' as any, 'Test')
      ).rejects.toThrow();
    });
  });

  describe('updateCreditLimit', () => {
    it('should delegate to walletService.updateCreditLimit', async () => {
      const superAdminUser = { id: 'admin1', email: 'admin@balatrix.com', role: Role.SUPER_ADMIN, tenantId: null } as any;
      const res = await controller.updateCreditLimit(superAdminUser, 'T_TARGET', 250);
      expect(res.success).toBe(true);
      expect(mockWalletService.updateCreditLimit).toHaveBeenCalledWith('T_TARGET', 250);
    });
  });

  describe('getAllSubscriptions', () => {
    it('should delegate to walletService.getAllSubscriptions with parsed query params', async () => {
      await controller.getAllSubscriptions('2', '25', 'Acme', 'ACTIVE', 'true');
      expect(mockWalletService.getAllSubscriptions).toHaveBeenCalledWith({
        page: 2,
        limit: 25,
        search: 'Acme',
        status: 'ACTIVE',
        hasSubscription: true
      });
    });

    it('should handle undefined optional query params gracefully', async () => {
      await controller.getAllSubscriptions();
      expect(mockWalletService.getAllSubscriptions).toHaveBeenCalledWith({
        page: undefined,
        limit: undefined,
        search: undefined,
        status: undefined,
        hasSubscription: undefined
      });
    });
  });

  describe('getSubscription', () => {
    it('should delegate to getAllSubscriptions when queryTenantId is "all" and user is SUPER_ADMIN', async () => {
      const superAdminUser = { id: 'admin1', email: 'admin@balatrix.com', role: Role.SUPER_ADMIN, tenantId: null } as any;
      await controller.getSubscription(superAdminUser, 'all', '1', '10', 'searchterm');
      expect(mockWalletService.getAllSubscriptions).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        search: 'searchterm',
        status: undefined,
        hasSubscription: undefined
      });
    });

    it('should throw ForbiddenException when queryTenantId is "all" and user is NOT SUPER_ADMIN', async () => {
      const regularAdmin = { id: 'u1', email: 'user@tenant.com', role: Role.ADMIN, tenantId: 'T1' } as any;
      expect(() => controller.getSubscription(regularAdmin, 'all')).toThrow('Only SuperAdmin can view all subscriptions');
    });

    it('should delegate to getSubscription for single tenant when tenantId is specific', async () => {
      const regularAdmin = { id: 'u1', email: 'user@tenant.com', role: Role.ADMIN, tenantId: 'T1' } as any;
      const res = await controller.getSubscription(regularAdmin, 'T1');
      expect(mockWalletService.getSubscription).toHaveBeenCalledWith('T1');
      expect(res).toEqual({ id: 'sub-1' });
    });
  });
});
