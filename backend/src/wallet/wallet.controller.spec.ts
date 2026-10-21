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
});
