
import { PrismaClient, InvoiceStatus } from '@prisma/client';
import { InvoiceService } from '../src/billing/invoice.service';
import { BillingService } from '../src/billing/billing.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

// Mock ConfigService
const mockConfigService = {
    get: (key: string) => null
} as any;

async function main() {
    console.log('Testing Invoice Flow...');

    const prisma = new PrismaClient();
    const prismaService = new PrismaService({
        datasources: { db: { url: process.env.DATABASE_URL } }
    });

    // Initialize services
    const billingService = new BillingService(prismaService, mockConfigService);
    const invoiceService = new InvoiceService(prismaService, billingService);

    // 1. Create a Seed Quote (if not exists)
    // We need a quote with a pricing snapshot.
    const quote = await prisma.quote.create({
        data: {
            customerName: 'Invoice Test',
            customerEmail: 'invoice@test.com',
            status: 'DRAFT',
            token: `inv-test-${Date.now()}`,
            expiresAt: new Date(Date.now() + 86400000),
            telecomDetails: {},
            pricingSnapshot: {
                subtotal: 100.00,
                currency: 'USD',
                items: [
                    { label: 'Test Plan', total: 100.00, quantity: 1 }
                ]
            }
        }
    });
    console.log(`Created Quote: ${quote.id}`);

    // 2. Create Invoice
    console.log('Creating Invoice...');
    const invoice = await invoiceService.createInvoiceFromQuote(quote.id);
    console.log(`Invoice Created: ${invoice.id}, Total: ${invoice.total}, Balance: ${invoice.balanceDue}`);

    if (Number(invoice.total) !== 100) throw new Error('Incorrect Invoice Total');

    // 3. Add Adjustment
    console.log('Adding Adjustment...');
    const adjusted = await invoiceService.addAdjustment(invoice.id, {
        reason: 'Test Credit',
        amount: -10.00,
        authorizedBy: 'TestScript'
    });
    console.log(`Invoice Adjusted: Balance: ${adjusted.balanceDue}`);

    if (Number(adjusted.balanceDue) !== 90) throw new Error('Incorrect Balance after adjustment');

    // 4. Finalize
    console.log('Finalizing Invoice...');
    const finalized = await invoiceService.finalizeInvoice(invoice.id);
    console.log(`Invoice Finalized: Status: ${finalized.status}, StripeID: ${finalized.stripeId}`);

    if (finalized.status !== InvoiceStatus.PENDING) throw new Error('Incorrect Status');

    console.log('Test Passed!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        // Cleanup?
    });
