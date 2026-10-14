import { BadGatewayException, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { of, throwError } from 'rxjs';
import { AddonsController } from './addons.controller';
import { AddonsService } from './addons.service';

describe('Add-on tenant isolation', () => {
    const admin = { role: Role.ADMIN, tenantId: 'tenant-a' };
    const root = { role: Role.SUPER_ADMIN, tenantId: null };
    const api = 'http://billing.invalid/api';
    let http: any;
    let wallet: any;
    let service: AddonsService;
    let controller: AddonsController;
    const addon = { id: 'addon-row-a', subscription_id: 'subscription-a', status: 'active' };

    beforeEach(() => {
        wallet = {
            getSubBillingCustomerId: jest.fn().mockResolvedValue('customer-a'),
            getBalance: jest.fn().mockResolvedValue({ balance: 100, creditLimit: 0 }),
            adjustBalance: jest.fn().mockResolvedValue({ success: true }),
        };
        http = {
            get: jest.fn((url: string) => {
                if (url === `${api}/subscriptions/customer/customer-a`) {
                    return of({ data: { success: true, data: [
                        { id: 'subscription-a', subscription_id: 'SUB-A', customer_id: 'customer-a' },
                    ] } });
                }
                if (url === `${api}/addons/subscription/subscription-a`) {
                    return of({ data: { success: true, data: [addon] } });
                }
                throw new Error(`Unexpected request: ${url}`);
            }),
            delete: jest.fn().mockReturnValue(of({ data: { success: true } })),
            patch: jest.fn().mockReturnValue(of({ data: { success: true } })),
            post: jest.fn().mockReturnValue(of({ data: { success: true } })),
        };
        service = new AddonsService({ subscription: { findFirst: jest.fn().mockResolvedValue(null) } } as any,
            wallet, http, { get: () => api } as any);
        controller = new AddonsController(service);
    });

    it.each([Role.ADMIN, Role.SUPPORT])('blocks %s reading another subscription', async role => {
        await expect(service.getSubscriptionAddons({ ...admin, role }, 'subscription-b'))
            .rejects.toThrow(NotFoundException);
        expect(http.get).not.toHaveBeenCalledWith(`${api}/addons/subscription/subscription-b`);
    });

    it.each(['subscription-a', 'SUB-A'])('resolves own subscription %s to its billing row ID', async id => {
        await expect(service.getSubscriptionAddons(admin, id)).resolves.toEqual({ success: true, data: [addon] });
    });

    it('rejects foreign addon cancel and auto-renew before any mutation', async () => {
        await expect(service.cancelSubscriptionAddon(admin, 'addon-row-b')).rejects.toThrow(NotFoundException);
        await expect(service.toggleAutoRenew(admin, 'addon-row-b', false)).rejects.toThrow(NotFoundException);
        expect(http.delete).not.toHaveBeenCalled();
        expect(http.patch).not.toHaveBeenCalled();
    });

    it('allows own addon cancel and auto-renew', async () => {
        await service.cancelSubscriptionAddon(admin, addon.id);
        await service.toggleAutoRenew(admin, addon.id, false);
        expect(http.delete).toHaveBeenCalledWith(`${api}/addons/subscription/${addon.id}`);
        expect(http.patch).toHaveBeenCalledWith(`${api}/addons/subscriptions/${addon.id}/auto-renew`, { auto_renew: false });
    });

    it('preserves explicit platform mutation authority', async () => {
        await service.cancelSubscriptionAddon(root, 'addon-row-b');
        expect(http.delete).toHaveBeenCalledWith(`${api}/addons/subscription/addon-row-b`);
        expect(wallet.getSubBillingCustomerId).not.toHaveBeenCalled();
    });

    it('fails closed if billing ownership cannot be verified', async () => {
        http.get.mockReturnValue(throwError(() => new Error('offline')));
        await expect(service.toggleAutoRenew(admin, addon.id, false)).rejects.toThrow(BadGatewayException);
        expect(http.patch).not.toHaveBeenCalled();
    });

    it('rejects a subscription response belonging to a different customer', async () => {
        http.get.mockReturnValue(of({ data: { success: true, data: [
            { id: 'subscription-b', customer_id: 'customer-b' },
        ] } }));
        await expect(service.cancelSubscriptionAddon(admin, 'addon-row-b')).rejects.toThrow(BadGatewayException);
        expect(http.delete).not.toHaveBeenCalled();
    });

    it('rejects addon rows belonging to another subscription', async () => {
        http.get.mockReturnValueOnce(of({ data: { success: true, data: [
            { id: 'subscription-a', customer_id: 'customer-a' },
        ] } })).mockReturnValueOnce(of({ data: { success: true, data: [
            { id: 'addon-row-b', subscription_id: 'subscription-b' },
        ] } }));
        await expect(service.cancelSubscriptionAddon(admin, 'addon-row-b')).rejects.toThrow(BadGatewayException);
        expect(http.delete).not.toHaveBeenCalled();
    });

    it('rejects URL-like resource selectors before internal requests', async () => {
        await expect(service.getSubscriptionAddons(admin, '../catalog')).rejects.toThrow(BadRequestException);
        expect(http.get).not.toHaveBeenCalled();
    });

    it('rejects a quote or purchase tenant override before any billing or wallet operation', () => {
        const body = { tenantId: 'tenant-b', addonId: 'addon_ext_1' };
        expect(() => controller.getQuote(admin as any, body)).toThrow(ForbiddenException);
        expect(() => controller.purchaseAddon(admin as any, body)).toThrow(ForbiddenException);
        expect(wallet.getSubBillingCustomerId).not.toHaveBeenCalled();
        expect(wallet.adjustBalance).not.toHaveBeenCalled();
        expect(http.post).not.toHaveBeenCalled();
    });

    it('uses the authenticated tenant for the purchase fallback debit', async () => {
        http.post.mockReturnValue(throwError(() => new Error('offline')));
        http.get.mockReturnValue(throwError(() => new Error('offline')));
        await controller.purchaseAddon(admin as any, { addonId: 'addon_ext_1', quantity: 1 });
        expect(wallet.getSubBillingCustomerId).toHaveBeenCalledWith('tenant-a');
        expect(wallet.adjustBalance).toHaveBeenCalledWith(
            'tenant-a', expect.any(Number), 'DEBIT', expect.any(String), expect.any(String),
        );
    });

    it('does not substitute a tenant UUID for a missing billing customer mapping', async () => {
        wallet.getSubBillingCustomerId.mockRejectedValue(new BadRequestException('Missing mapping'));
        await expect(service.getQuote('tenant-a', 'addon_ext_1')).rejects.toThrow(BadRequestException);
        await expect(service.purchaseAddon('tenant-a', 'addon_ext_1')).rejects.toThrow(BadRequestException);
        expect(http.post).not.toHaveBeenCalled();
        expect(wallet.adjustBalance).not.toHaveBeenCalled();
    });
});
