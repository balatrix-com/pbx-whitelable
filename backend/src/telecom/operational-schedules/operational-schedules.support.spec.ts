import { ForbiddenException } from '@nestjs/common';
import { OperationalSchedulesController } from './operational-schedules.controller';

describe('Operational schedule tenant scope', () => {
    const schedules = { findAll: jest.fn().mockResolvedValue([]) };
    const controller = new OperationalSchedulesController(schedules as any);

    beforeEach(() => schedules.findAll.mockClear());

    it('lets tenant support list only their tenant schedules', async () => {
        await controller.findAll({ role: 'SUPPORT', tenantId: 'tenant-1' });
        expect(schedules.findAll).toHaveBeenCalledWith('tenant-1');
    });

    it('rejects platform support without a tenant before querying', () => {
        expect(() => controller.findAll({ role: 'SUPPORT', tenantId: null })).toThrow(ForbiddenException);
        expect(schedules.findAll).not.toHaveBeenCalled();
    });
});
