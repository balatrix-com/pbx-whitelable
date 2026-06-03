import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StripeService {
    private stripe: Stripe;
    private readonly logger = new Logger(StripeService.name);

    constructor(
        private configService: ConfigService,
        private prisma: PrismaService,
    ) {
        const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
        if (!secretKey) {
            this.logger.error('STRIPE_SECRET_KEY is not defined');
            throw new Error('STRIPE_SECRET_KEY is not defined');
        }

        this.stripe = new Stripe(secretKey, {
            apiVersion: '2024-12-18.acacia' as any, // Bypass strict type check
        });
    }

    async createCheckoutSession(quoteId: string) {
        const quote = await this.prisma.quote.findUnique({
            where: { id: quoteId },
            include: {
                plan: true,
            },
        });

        if (!quote) {
            throw new Error('Quote not found');
        }

        const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

        const pricing = quote.pricingSnapshot as any;
        const totalRecurring = Number(pricing?.totalRecurring || 0);
        const totalOneTime = Number(pricing?.totalOneTime || 0);

        // 1. Recurring Plan
        if (totalRecurring > 0) {
            lineItems.push({
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `${quote.plan?.name || 'Service'} (First Month)`,
                        description: 'First month payment',
                    },
                    unit_amount: Math.round(Number(totalRecurring) * 100), // Cents
                },
                quantity: 1,
            });
        }

        // 2. One-Time Charges (Setup fees, Wallet Credit, Prorated items)
        if (totalOneTime > 0) {
            lineItems.push({
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: 'One-Time Charges',
                        description: 'Setup fees, device costs, or initial wallet credit',
                    },
                    unit_amount: Math.round(Number(totalOneTime) * 100),
                },
                quantity: 1,
            });
        }

        // Determine mode
        const mode = 'payment';

        const session = await this.stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: mode,
            success_url: `${this.configService.get('FRONTEND_URL')}/onboarding/${quote.token}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${this.configService.get('FRONTEND_URL')}/onboarding/${quote.token}/payment`,
            customer_email: quote.customerEmail,
            metadata: {
                quoteId: quote.id,
                customerCompany: quote.customerCompany
            },
            expand: ['payment_intent'],
        });

        return {
            sessionId: session.id,
            url: session.url
        };
    }

    async verifySession(sessionId: string) {
        const session = await this.stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status !== 'paid') {
            throw new Error('Payment not completed');
        }
        return session;
    }
}
