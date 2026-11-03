import { Controller, Post, Get, Headers, Req, UseGuards, BadRequestException, ForbiddenException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Request } from 'express';

@Controller('billing')
export class BillingController {
    constructor(private readonly billingService: BillingService) { }

    @Post('create-checkout')
    @UseGuards(JwtAuthGuard)
    createCheckout() {
        throw new ForbiddenException('Card checkout is disabled. Payments are managed manually by administration.');
    }

    @Post('webhook')
    async handleWebhook(@Headers('stripe-signature') signature: string, @Req() req: Request) {
        if (!signature) throw new BadRequestException('Missing signature');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawBody = (req as any).rawBody || req.body;
        return this.billingService.handleWebhook(signature, rawBody);
    }

    @Get('payment-methods')
    @UseGuards(JwtAuthGuard)
    listPaymentMethods() {
        return [];
    }

    @Post('set-default-card')
    @UseGuards(JwtAuthGuard)
    setDefaultCard() {
        throw new ForbiddenException('Payment methods are disabled.');
    }
}
