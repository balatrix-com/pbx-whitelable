import { Body, Controller, Post, UseGuards, BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InternalServiceGuard } from '../../auth/guards/internal-service.guard';
import { ExtensionsService } from './extensions.service';

@Controller('internal/extensions')
@UseGuards(InternalServiceGuard)
export class InternalExtensionSyncController {
    constructor(private readonly prisma: PrismaService, private readonly extensions: ExtensionsService) { }

    @Post('sync-from-billing')
    async sync(@Body() body: { customerId?: string; subscriptionId?: string; eventId?: string }) {
        if (!body || typeof body.customerId !== 'string' || typeof body.subscriptionId !== 'string' ||
            typeof body.eventId !== 'string' || !body.customerId || !body.subscriptionId || !body.eventId) {
            throw new BadRequestException('customerId, subscriptionId and eventId are required');
        }
        const subscription = await this.prisma.subscription.findUnique({
            where: { subBillingSubscriptionId: body.subscriptionId },
            include: { tenant: true },
        });
        if (!subscription) {
            // Billing may commit its assets before PBX creates the local mapping.
            // A 503 keeps this event retryable in the billing outbox.
            throw new ServiceUnavailableException('Subscription mapping is not ready');
        }
        if (subscription.status !== 'ACTIVE' ||
            subscription.tenant.subBillingCustomerId !== body.customerId) {
            throw new NotFoundException('Active subscription mapping not found');
        }
        const result = await this.extensions.syncMissingExtensionsFromSubBilling(subscription.tenantId);
        if (result.syncFailed > 0) throw new ServiceUnavailableException('Extension synchronization incomplete');
        return { ...result, eventId: body.eventId };
    }
}
