
import { PrismaClient, QuoteStatus, InvoiceStatus } from '@prisma/client';
import { OnboardingService } from '../src/onboarding/onboarding.service';
import { BillingService } from '../src/billing/billing.service';
import { InvoiceService } from '../src/billing/invoice.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { FreeSwitchSyncService } from '../src/freeswitch/freeswitch-sync.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

// Mocks
const mockConfigService = {
    get: (key: string) => {
        if (key === 'JWT_SECRET') return 'test-secret';
        return null;
    }
} as any;

const mockJwtService = {
    sign: (payload: any) => 'mock_token'
} as any;

const mockFreeSwitchSync = {
    syncExtension: async (id: string) => console.log(`[Mock] Sync Ext ${id}`)
} as any;

async function main() {
    console.log('Testing Onboarding Invoice Flow...');

    const prismaService = new PrismaService({
        datasources: { db: { url: process.env.DATABASE_URL } }
    });

    const billingService = new BillingService(prismaService, mockConfigService);
    const invoiceService = new InvoiceService(prismaService, billingService);
    const mockWalletService = {
        adjustBalance: async () => console.log('[Mock] Adjust Balance')
    } as any;

    const mockStripeService = {
        verifySession: async () => ({ id: 'mock_sess', payment_status: 'paid' })
    } as any;

    const mockNotificationsService = {
        createNotification: async () => console.log('[Mock] Create Notification')
    } as any;

    const mockLookupRedis = {
        updateExtensionLookup: async () => console.log('[Mock] Update Extension Lookup'),
        updateNumberLookup: async () => console.log('[Mock] Update Number Lookup')
    } as any;

    const mockHttpService = {
        post: () => {
            return {
                toPromise: () => Promise.resolve({ data: { success: true } }),
                subscribe: (obs: any) => obs.next({ data: { success: true } })
            } as any;
        }
    } as any;

    const mockMailService = {
        sendOnboardingCompletionEmail: async () => console.log('[Mock] Send Onboarding Completion Email'),
        sendSupportInvitationEmail: async () => console.log('[Mock] Send Support Invitation Email'),
    } as any;

    const onboardingService = new OnboardingService(
        prismaService,
        billingService,
        invoiceService,
        mockWalletService,
        mockJwtService,
        mockConfigService,
        mockFreeSwitchSync,
        mockStripeService,
        mockNotificationsService,
        mockLookupRedis,
        mockHttpService,
        mockMailService
    );

    // 1. Create Quote
    const quote = await prismaService.quote.create({
        data: {
            customerName: 'Onboarding Test',
            customerEmail: 'onboard@test.com',
            status: 'DRAFT',
            token: `onb-test-${Date.now()}`,
            expiresAt: new Date(Date.now() + 86400000),
            telecomDetails: {},
            pricingSnapshot: {
                subtotal: 50.00,
                items: [{ label: 'Plan A', total: 50.00 }]
            },
            // We need a plan for subscription, though invoice doesn't strictly depend on it, subscription creation does
            // Let's rely on standard seeding or create a plan if needed.
            // Assuming plan_seed_123 exists from previous steps.
            planId: 'plan_seed_123'
        }
    });
    console.log(`Created Quote: ${quote.id}`);

    // 2. Mock Payment Init
    // 2. Mock Checkout Init
    const checkoutSession = await onboardingService.createCheckoutSession(quote.token);
    console.log('Checkout Session:', checkoutSession);

    // 3. Finalize
    console.log('Finalizing...');
    const result = await onboardingService.completeOnboarding(quote.token, {
        adminPassword: 'password123',
        extensionNames: ['Sales', 'Support'],
        sessionId: 'mock_sess_123'
    });

    console.log('Finalize Result:', result);

    // 4. Verify DB State
    // 4. Verify DB State
    const updatedQuote = await prismaService.quote.findUnique({ where: { id: quote.id } });
    if (!updatedQuote) throw new Error('Quote not found');
    if (updatedQuote.status !== QuoteStatus.CONVERTED) throw new Error('Quote not Converted');

    const tenantId = updatedQuote.tenantId;
    if (!tenantId) throw new Error('Tenant ID missing');
    const invoice = await prismaService.invoice.findFirst({ where: { tenantId } });

    if (!invoice) throw new Error('Invoice not found');
    console.log(`Invoice: ${invoice.id}, Status: ${invoice.status}, Total: ${invoice.total}`);

    if (invoice.status !== InvoiceStatus.PAID) throw new Error('Invoice not PAID');
    if (Number(invoice.total) !== 50) throw new Error('Incorrect Invoice Total');

    const subscription = await prismaService.subscription.findFirst({ where: { tenantId } });
    if (!subscription) throw new Error('Subscription not created');

    console.log('Test Passed!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
