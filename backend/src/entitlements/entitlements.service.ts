import { BadGatewayException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { firstValueFrom } from 'rxjs';

type Resource = 'extensions' | 'tfns' | 'dids';

@Injectable()
export class EntitlementsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly http: HttpService,
        private readonly config: ConfigService,
    ) { }

    async allowance(tenantId: string): Promise<Record<Resource, number>> {
        const subscriptions = await this.prisma.subscription.findMany({
            where: { tenantId, status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            take: 2,
            include: { tenant: true },
        });
        if (subscriptions.length !== 1) {
            throw new ConflictException('Tenant must have exactly one active subscription');
        }
        const subscription = subscriptions[0];
        if (!subscription?.subBillingSubscriptionId || !subscription.tenant.subBillingCustomerId) {
            throw new NotFoundException('Active billing subscription not found');
        }
        const base = this.config.get<string>('subBilling.apiUrl');
        if (!base) throw new BadGatewayException('Billing service is not configured');
        let data: any;
        try {
            const url = `${base}/pbx/entitlements/${encodeURIComponent(subscription.subBillingSubscriptionId)}`;
            data = (await firstValueFrom(this.http.get(url))).data;
        } catch {
            throw new BadGatewayException('Unable to verify subscription entitlement');
        }
        if (data?.subscriptionId !== subscription.subBillingSubscriptionId ||
            data?.customerId !== subscription.tenant.subBillingCustomerId ||
            !data.allowed ||
            (['extensions', 'tfns', 'dids'] as Resource[]).some(resource =>
                !Number.isSafeInteger(data.allowed[resource]) || data.allowed[resource] < 0)) {
            throw new BadGatewayException('Invalid billing entitlement response');
        }
        return data.allowed;
    }

    async withAvailableSlot<T>(tenantId: string, resource: Resource, action: (tx: any) => Promise<T>): Promise<T> {
        const allowed = (await this.allowance(tenantId))[resource];
        return this.prisma.$transaction(async tx => {
            // Serialize every quota-consuming operation for this tenant.
            const owner = await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId} FOR UPDATE`;
            if (!Array.isArray(owner) || owner.length !== 1) throw new NotFoundException('Tenant not found');
            const count = resource === 'extensions' ? await tx.extension.count({ where: { tenantId } }) :
                resource === 'tfns' ? await tx.tFN.count({ where: { tenantId } }) :
                    await tx.dID.count({ where: { tenantId } });
            if (count >= allowed) throw new ConflictException(`${resource} subscription limit reached`);
            return action(tx);
        }, { timeout: 30000 });
    }
}
