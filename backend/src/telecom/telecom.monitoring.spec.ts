import { TelecomService } from './telecom.service';

describe('Legacy monitoring endpoint compatibility', () => {
    it('counts active calls from the tenant-scoped Redis monitor instead of add-on or mock data', async () => {
        const service = Object.create(TelecomService.prototype) as TelecomService;
        const getActiveCalls = jest.fn().mockResolvedValue([{ uuid: 'call-1' }, { uuid: 'call-2' }]);
        (service as any).monitorService = { getActiveCalls };

        await expect(service.getMonitoringStatus('U1012')).resolves.toEqual({
            active: true,
            activeCalls: 2,
            queues: [],
        });
        expect(getActiveCalls).toHaveBeenCalledWith('U1012');
    });
});
