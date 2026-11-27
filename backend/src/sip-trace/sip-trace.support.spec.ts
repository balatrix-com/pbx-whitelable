import { Role } from '@prisma/client';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { SipTraceController, TenantSipTraceController } from './sip-trace.controller';

describe('Support SIP trace access', () => {
  it('allows tenant support without granting the platform trace endpoint', () => {
    expect(Reflect.getMetadata(ROLES_KEY, TenantSipTraceController)).toEqual([Role.ADMIN, Role.SUPPORT]);
    expect(Reflect.getMetadata(ROLES_KEY, SipTraceController)).toEqual([Role.SUPER_ADMIN]);
  });

  it('forwards the authenticated tenant ID to every tenant trace operation', async () => {
    const traces = {
      tenantList: jest.fn().mockResolvedValue({ data: [] }),
      flow: jest.fn().mockResolvedValue({ messages: [] }),
      raw: jest.fn().mockResolvedValue({ raw: '' }),
    };
    const controller = new TenantSipTraceController(traces as any);
    await controller.list('tenant-1', { search: '' });
    await controller.flow('tenant-1', 'session-1');
    await controller.raw('tenant-1', 'session-1', 'message-1');
    expect(traces.tenantList).toHaveBeenCalledWith('tenant-1', { search: '' });
    expect(traces.flow).toHaveBeenCalledWith('session-1', 'tenant-1');
    expect(traces.raw).toHaveBeenCalledWith('session-1', 'message-1', 'tenant-1');
  });
});
