import { Test, TestingModule } from '@nestjs/testing';
import { OnboardingService } from './onboarding.service';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { InvoiceService } from '../billing/invoice.service';
import { WalletService } from '../wallet/wallet.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { FreeSwitchSyncService } from '../freeswitch/freeswitch-sync.service';
import { StripeService } from '../payments/stripe.service';
import { LookupRedisService } from '../redis/lookup-redis.module';
import { HttpService } from '@nestjs/axios';
import { MailService } from '../mail/mail.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

describe('OnboardingService (Unit)', () => {
    let service: OnboardingService;
    let prisma: any;

    beforeEach(async () => {
        prisma = {
            tenant: {
                findUnique: jest.fn(),
                create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, id: data.id || 'mock-id' })),
                update: jest.fn(),
                count: jest.fn().mockResolvedValue(0),
            },
            user: {
                findUnique: jest.fn(),
                create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, id: 'user-id' })),
                update: jest.fn(),
            },
            plan: {
                findFirst: jest.fn().mockResolvedValue({ id: 'plan-id', name: 'Basic Plan', freeMinutes: 100, maxExtensions: 2 }),
            },
            subscription: {
                findUnique: jest.fn(),
                create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, id: 'sub-id' })),
            },
            extension: {
                count: jest.fn().mockResolvedValue(0),
                create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, id: 'ext-id' })),
            },
            tFN: {
                findUnique: jest.fn(),
                update: jest.fn(),
            },
            $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OnboardingService,
                { provide: PrismaService, useValue: prisma },
                { provide: BillingService, useValue: {} },
                { provide: InvoiceService, useValue: {} },
                { provide: WalletService, useValue: {} },
                { provide: JwtService, useValue: {} },
                { provide: ConfigService, useValue: { get: jest.fn() } },
                { provide: FreeSwitchSyncService, useValue: { syncTFN: jest.fn().mockResolvedValue({}) } },
                { provide: StripeService, useValue: {} },
                { provide: LookupRedisService, useValue: { updateExtensionLookup: jest.fn(), updateNumberLookup: jest.fn() } },
                { provide: HttpService, useValue: { get: jest.fn(), post: jest.fn() } },
                { provide: MailService, useValue: { sendOnboardingCompletionEmail: jest.fn() } },
                { provide: EntitlementsService, useValue: { allowance: jest.fn().mockResolvedValue({ tfns: 1 }) } },
            ],
        }).compile();

        service = module.get<OnboardingService>(OnboardingService);
    });

    it('should extract numeric company code from U0010 and use it for extensions', async () => {
        const data = {
            subBillingCustomerId: 'U0010',
            subBillingSubscriptionId: 'SUB-001',
            customerName: 'Test Customer',
            customerEmail: 'test@example.com',
            planName: 'Basic Plan',
            extensionCount: 2,
            freeMinutes: 100,
        };

        const result = await service.provisionTenantFromSubBilling(data as any);

        // Verify tenant creation
        expect(prisma.tenant.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                id: 'U0010',
                subBillingCustomerId: 'U0010',
                customerCode: 'U0010',
            }),
        }));

        // Verify extension creation using 0010 as prefix
        expect(prisma.extension.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                extensionNumber: 'U001001',
                sipUsername: 'U001001',
                sipPassword: expect.any(String),
            }),
        }));

        expect(prisma.extension.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                extensionNumber: 'U001002',
                sipUsername: 'U001002',
                sipPassword: expect.any(String),
            }),
        }));

        expect(result.tenant.customerCode).toBe('U0010');
    });
});
