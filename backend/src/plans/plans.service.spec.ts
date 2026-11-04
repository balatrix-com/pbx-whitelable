import { Test, TestingModule } from '@nestjs/testing';
import { PlansService } from './plans.service';
import { PrismaService } from '../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { BadRequestException } from '@nestjs/common';

describe('PlansService', () => {
  let service: PlansService;
  let httpService: any;
  let prismaService: any;

  beforeEach(async () => {
    httpService = {
      get: jest.fn(),
      post: jest.fn(),
      delete: jest.fn(),
    };

    prismaService = {
      plan: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'local-1', ...args.data })),
        count: jest.fn(),
        delete: jest.fn(),
      },
      subscription: {
        count: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlansService,
        { provide: PrismaService, useValue: prismaService },
        { provide: HttpService, useValue: httpService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('http://localhost:5005/api'),
          },
        },
      ],
    }).compile();

    service = module.get<PlansService>(PlansService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRateCards', () => {
    it('should fetch and return rate cards from sub-billing', async () => {
      const mockRateCards = [
        { ratecard_id: 1, name: 'Standard_Global', currency: 'USD' },
        { ratecard_id: 2, name: 'Default Rate Card', currency: 'USD' },
      ];
      httpService.get.mockReturnValue(of({ data: { success: true, data: mockRateCards } }));

      const result = await service.getRateCards();
      expect(httpService.get).toHaveBeenCalledWith('http://localhost:5005/api/rate-cards');
      expect(result).toEqual(mockRateCards);
    });

    it('should return empty array on sub-billing network failure', async () => {
      httpService.get.mockReturnValue(throwError(() => new Error('Connection refused')));

      const result = await service.getRateCards();
      expect(result).toEqual([]);
    });
  });

  describe('createCustom', () => {
    it('should forward rate_card_id to sub-billing /v1/plans', async () => {
      const planPayload = {
        name: 'Starter Pro Plan',
        amount: 49.99,
        rate_card_id: '2',
        tfns: 2,
        dids: 1,
        extensions: 5,
        free_mins: 1000,
      };

      httpService.post.mockReturnValue(of({ data: { success: true, plan: { ...planPayload, plan_id: 'starter_pro_plan' } } }));

      const result = await service.createCustom(planPayload, 'admin-user-123');

      expect(httpService.post).toHaveBeenCalledWith(
        'http://localhost:5005/api/v1/plans',
        expect.objectContaining({
          rate_card_id: '2',
          name: 'Starter Pro Plan',
          plan_id: 'starter_pro_plan',
        })
      );
      expect(result).toBeDefined();
    });
  });

  describe('deletePlan', () => {
    it('should throw BadRequestException if active local subscriptions exist', async () => {
      prismaService.plan.findFirst.mockResolvedValue({ id: 'plan-1', name: 'Starter' });
      prismaService.subscription.count.mockResolvedValue(2);

      await expect(service.deletePlan('plan-1')).rejects.toThrow(BadRequestException);
      expect(httpService.delete).not.toHaveBeenCalled();
    });

    it('should successfully delete or archive plan via sub-billing when 0 active subscriptions', async () => {
      prismaService.plan.findFirst.mockResolvedValue({ id: 'plan-1', name: 'Starter' });
      prismaService.subscription.count.mockResolvedValue(0);
      httpService.delete.mockReturnValue(of({ data: { success: true, message: 'Plan deleted successfully' } }));
      prismaService.subscription.deleteMany.mockResolvedValue({ count: 1 });
      prismaService.plan.delete.mockResolvedValue({ id: 'plan-1' });

      const result = await service.deletePlan('plan-1');
      expect(httpService.delete).toHaveBeenCalledWith('http://localhost:5005/api/plans/plan-1');
      expect(result).toEqual({ success: true, message: 'Plan "plan-1" deleted successfully' });
    });

    it('should propagate 409 from sub-billing as BadRequestException', async () => {
      prismaService.plan.findFirst.mockResolvedValue(null);
      httpService.delete.mockReturnValue(
        throwError(() => ({
          response: {
            status: 409,
            data: { message: '1 active subscription(s) still reference it' },
          },
        }))
      );

      await expect(service.deletePlan('plan-99')).rejects.toThrow(BadRequestException);
    });
  });
});
