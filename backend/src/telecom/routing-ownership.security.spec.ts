import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DIDsService } from './dids/dids.service';
import { TFNsService } from './tfns/tfns.service';
import { OperationalSchedulesService } from './operational-schedules/operational-schedules.service';
import { IVRsService } from './ivrs/ivrs.service';
import { RingGroupsService } from './ring-groups/ring-groups.service';
import { RingStrategy } from './ring-groups/dto';
import { TelecomService } from './telecom.service';

describe('Tenant-owned routing targets', () => {
    let prisma: any;
    let sync: any;
    let redis: any;

    beforeEach(() => {
        prisma = {
            dID: { findFirst: jest.fn().mockResolvedValue({ id: 'did-a', tenantId: 'tenant-a', number: '100', routeType: 'extension', routeTargetId: 'ext-a' }), update: jest.fn().mockResolvedValue({ id: 'did-a', number: '100' }) },
            tFN: { findFirst: jest.fn().mockResolvedValue({ id: 'tfn-a', tenantId: 'tenant-a', number: '200', routeType: 'extension', routeTargetId: 'ext-a' }), findUnique: jest.fn().mockResolvedValue({ id: 'tfn-a', tenantId: 'tenant-a', number: '200', routeType: 'extension', routeTargetId: 'ext-a' }), update: jest.fn().mockResolvedValue({ id: 'tfn-a', tenantId: 'tenant-a', number: '200' }) },
            extension: { findFirst: jest.fn(({ where }: any) => Promise.resolve(where.id === 'ext-a' && where.tenantId === 'tenant-a' ? { id: 'ext-a' } : null)) },
            operationalSchedule: { findFirst: jest.fn(({ where }: any) => Promise.resolve(where?.id === 'schedule-a' && where?.tenantId === 'tenant-a' ? { id: 'schedule-a', tenantId: 'tenant-a', primaryRouteType: 'extension', primaryRouteTarget: 'ext-a', afterHoursRouteType: 'ring_group', afterHoursRouteTarget: 'ring-a', weekendRouteType: '', weekendRouteTarget: '' } : null)), update: jest.fn().mockResolvedValue({ id: 'schedule-a', name: 'A' }) },
            ringGroup: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), count: jest.fn().mockResolvedValue(0) },
            iVR: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), count: jest.fn().mockResolvedValue(0) },
            dIDForward: { findFirst: jest.fn().mockResolvedValue(null) },
            tenantFeature: { findUnique: jest.fn().mockResolvedValue(null) },
        };
        prisma.$transaction = jest.fn((fn: any) => fn(prisma));
        sync = { syncDID: jest.fn(), syncTFN: jest.fn(), syncSchedule: jest.fn(), syncIVR: jest.fn(), syncRingGroup: jest.fn() };
        redis = { updateNumberLookup: jest.fn() };
    });

    it('rejects a DID target-only PATCH to a foreign extension before update or sync', async () => {
        const service = new DIDsService(prisma, sync, redis, {} as any, {} as any, {} as any);
        await expect(service.update('tenant-a', 'did-a', { routeDestinationId: 'ext-b' }))
            .rejects.toThrow(BadRequestException);
        expect(prisma.extension.findFirst).toHaveBeenCalledWith({ where: { id: 'ext-b', tenantId: 'tenant-a' } });
        expect(prisma.dID.update).not.toHaveBeenCalled();
        expect(sync.syncDID).not.toHaveBeenCalled();
        await service.update('tenant-a', 'did-a', { routeDestinationId: 'ext-a' });
        expect(prisma.dID.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'did-a', tenantId: 'tenant-a' } }));
    });

    it('rejects both TFN update paths when a partial target belongs to another tenant', async () => {
        const service = new TFNsService(prisma, sync, redis, {} as any, {} as any, {} as any);
        await expect(service.update('tenant-a', 'tfn-a', { routeDestinationId: 'ext-b' }))
            .rejects.toThrow(BadRequestException);
        const telecom = new TelecomService(prisma, {} as any, {} as any, sync, {} as any, {} as any,
            {} as any, {} as any);
        await expect(telecom.updateTFNRouting('tfn-a', 'tenant-a', { routeTargetId: 'ext-b' }))
            .rejects.toThrow(BadRequestException);
        expect(prisma.tFN.update).not.toHaveBeenCalled();
        expect(sync.syncTFN).not.toHaveBeenCalled();
    });

    it('validates primary, after-hours and weekend schedule target-only PATCHes', async () => {
        const service = new OperationalSchedulesService(prisma, sync);
        for (const field of ['primaryRouteTargetId', 'afterHoursRouteTargetId', 'weekendRouteTargetId']) {
            await expect(service.update('tenant-a', 'schedule-a', { [field]: 'foreign-id' }))
                .rejects.toThrow(BadRequestException);
        }
        expect(prisma.operationalSchedule.update).not.toHaveBeenCalled();
        expect(sync.syncSchedule).not.toHaveBeenCalled();
    });

    it.each(['schedule', 'did_forward', 'forward'])('rejects a foreign %s IVR target, including submenus', async type => {
        const service = new IVRsService(prisma, sync);
        await expect(service.create('tenant-a', { name: 'A menu', menu: {
            1: { type: 'submenu', children: { 2: { type, target: 'foreign-id' } } },
        } } as any)).rejects.toThrow(BadRequestException);
        expect(prisma.iVR.create).not.toHaveBeenCalled();
        expect(sync.syncIVR).not.toHaveBeenCalled();
    });

    it('rejects foreign extensions in nested ring group creation', async () => {
        prisma.extension.count = jest.fn().mockResolvedValue(0);
        const service = new RingGroupsService(prisma, sync);
        await expect(service.create('tenant-a', { name: 'A group', strategy: RingStrategy.SIMULTANEOUS,
            members: [{ extensionId: 'ext-b' }], } as any)).rejects.toThrow(BadRequestException);
        expect(prisma.ringGroup.create).not.toHaveBeenCalled();
        expect(sync.syncRingGroup).not.toHaveBeenCalled();
    });

    it('rejects a foreign ring group member ID and returns no SIP password for an owned member', async () => {
        prisma.ringGroup.findFirst.mockResolvedValue({ id: 'ring-a', tenantId: 'tenant-a' });
        prisma.ringGroupMember = {
            findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'member-a' }),
            update: jest.fn().mockResolvedValue({ id: 'member-a', extension: { id: 'ext-a', extensionNumber: '101', name: 'A' } }),
        };
        const service = new RingGroupsService(prisma, sync);
        await expect(service.updateMember('tenant-a', 'ring-a', 'member-b', { position: 2 }))
            .rejects.toThrow(NotFoundException);
        expect(prisma.ringGroupMember.update).not.toHaveBeenCalled();
        const member = await service.updateMember('tenant-a', 'ring-a', 'member-a', { position: 2 });
        expect(prisma.ringGroupMember.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'member-a', ringGroupId: 'ring-a' },
            include: { extension: { select: { id: true, extensionNumber: true, name: true } } },
        }));
        expect(JSON.stringify(member)).not.toContain('sipPassword');
    });
});
