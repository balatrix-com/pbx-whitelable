import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { AddonsController } from '../addons/addons.controller';
import { ExtensionsController } from '../telecom/extensions/extensions.controller';
import { DIDsController } from '../telecom/dids/dids.controller';
import { TFNsController } from '../telecom/tfns/tfns.controller';
import { PhoneNumbersController } from '../telecom/phone-numbers/phone-numbers.controller';
import { SubscriptionTelecomController } from '../telecom/subscription-telecom.controller';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

describe('Chunk 1 API boundary enforcement', () => {
    const tenantSupport = { role: Role.SUPPORT, tenantId: 'tenant-a', platformSupport: false };
    const platformSupport = { role: Role.SUPPORT, tenantId: null, platformSupport: true };

    it.each([
        [AddonsController, 'createCatalogItem'],
        [AddonsController, 'deleteCatalogItem'],
        [ExtensionsController, 'syncFromBilling'],
    ] as const)('%s.%s requires an authenticated SUPER_ADMIN', (controllerClass, method) => {
        const handler = (controllerClass.prototype as any)[method];
        const reflector = new Reflector();
        expect(reflector.getAllAndOverride(IS_PUBLIC_KEY, [handler, controllerClass])).not.toBe(true);
        expect(Reflect.getMetadata(GUARDS_METADATA, controllerClass)).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
        for (const role of [undefined, Role.ADMIN, Role.SUPPORT, Role.SUPER_ADMIN]) {
            const context = {
                getHandler: () => handler,
                getClass: () => controllerClass,
                switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
            } as unknown as ExecutionContext;
            expect(new RolesGuard(reflector).canActivate(context)).toBe(role === Role.SUPER_ADMIN);
        }
        expect(() => new JwtAuthGuard(reflector).handleRequest(null, false, null, {} as ExecutionContext))
            .toThrow(UnauthorizedException);
    });

    it('blocks tenant Support overrides on extension reads, status, create and delete', () => {
        const service = { findAll: jest.fn(), getActiveStatus: jest.fn(), create: jest.fn(), remove: jest.fn() };
        const controller = new ExtensionsController(service as any);
        expect(() => controller.findAll(tenantSupport, 'tenant-b')).toThrow(ForbiddenException);
        expect(() => controller.getStatus(tenantSupport, 'tenant-b')).toThrow(ForbiddenException);
        expect(() => controller.create(tenantSupport, { targetTenantId: 'tenant-b' } as any)).toThrow(ForbiddenException);
        expect(() => controller.remove(tenantSupport, 'extension-b', 'tenant-b')).toThrow(ForbiddenException);
        for (const mock of Object.values(service)) expect(mock).not.toHaveBeenCalled();
        controller.findAll(tenantSupport);
        expect(service.findAll).toHaveBeenCalledWith('tenant-a');
        controller.findAll(platformSupport, 'tenant-b');
        expect(service.findAll).toHaveBeenCalledWith('tenant-b');
    });

    it('blocks tenant Support overrides on DID, TFN and unified phone-number reads', () => {
        const service = { findAll: jest.fn() };
        const calls = [
            (user: any, tenantId?: string) => new DIDsController(service as any).findAll(user, tenantId),
            (user: any, tenantId?: string) => new TFNsController(service as any).findAll({ user }, tenantId),
            (user: any, tenantId?: string) => new PhoneNumbersController(service as any).findAll(user, tenantId),
        ];
        for (const call of calls) {
            expect(() => call(tenantSupport, 'tenant-b')).toThrow(ForbiddenException);
        }
        expect(service.findAll).not.toHaveBeenCalled();
        for (const call of calls) {
            call(tenantSupport);
            expect(service.findAll).toHaveBeenLastCalledWith('tenant-a');
            call(platformSupport, 'tenant-b');
            expect(service.findAll).toHaveBeenLastCalledWith('tenant-b');
        }
    });

    it('blocks the subscription asset aliases before billing requests or local fallback', async () => {
        const assets = { getAssets: jest.fn() };
        const numbers = { findAll: jest.fn() };
        const controller = new SubscriptionTelecomController(numbers as any, numbers as any, {} as any, assets as any);
        await expect(controller.findAllTfns(tenantSupport, 'tenant-b')).rejects.toThrow(ForbiddenException);
        await expect(controller.findAllDids(tenantSupport, 'tenant-b')).rejects.toThrow(ForbiddenException);
        expect(assets.getAssets).not.toHaveBeenCalled();
        expect(numbers.findAll).not.toHaveBeenCalled();
    });

    it('passes the selected PBX tenant to the authenticated sync operation', async () => {
        const service = { syncMissingExtensionsFromSubBilling: jest.fn().mockResolvedValue(undefined) };
        const controller = new ExtensionsController(service as any);
        await controller.syncFromBilling({ role: Role.SUPER_ADMIN, tenantId: null }, { tenantId: 'tenant-b' });
        expect(service.syncMissingExtensionsFromSubBilling).toHaveBeenCalledWith('tenant-b');
    });
});
