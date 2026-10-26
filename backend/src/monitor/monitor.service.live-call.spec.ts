import { MonitorService } from './monitor.service';

describe('MonitorService live-call ownership', () => {
  const redis = {
    exists: jest.fn().mockResolvedValue(1),
    hGetAll: jest.fn().mockResolvedValue({
      call_status: 'answered', b_uuid: 'b-leg', customer_id: 'U1001',
    }),
  };
  const prisma = {
    tenant: { findUnique: jest.fn().mockResolvedValue({
      customerCode: 'U1001', subBillingCustomerId: null,
    }) },
  };
  const service = new MonitorService(redis as any, {} as any, prisma as any);

  beforeEach(() => jest.clearAllMocks());

  it('accepts only the current B leg paired with a tenant-owned A leg', async () => {
    expect(await service.verifyCallTenant('a-leg', 'tenant-id', 'b-leg')).toBe(true);
    expect(await service.verifyCallTenant('a-leg', 'tenant-id', 'foreign-b-leg')).toBe(false);
  });

  it('rejects ended calls even if a stale Redis hash remains', async () => {
    redis.hGetAll.mockResolvedValueOnce({ call_status: 'hangup', b_uuid: 'b-leg' });
    expect(await service.verifyCallTenant('a-leg', 'tenant-id', 'b-leg')).toBe(false);
  });
});
