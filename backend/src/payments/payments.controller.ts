import { Controller, Post, Body, Param } from '@nestjs/common';
import { StripeService } from './stripe.service';

@Controller('payments')
export class PaymentsController {
    constructor(private readonly stripeService: StripeService) { }

    @Post('checkout/:quoteId')
    async createCheckoutSession(@Param('quoteId') quoteId: string) {
        return this.stripeService.createCheckoutSession(quoteId);
    }
}
