import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PlansController } from './plans.controller';

describe('Plan deletion authorization', () => {
  it.each([Role.ADMIN, Role.SUPPORT, Role.SUPER_ADMIN])('checks %s before deleting a plan', async role => {
    const service = { deletePlan: jest.fn().mockResolvedValue({ success: true }) };
    const controller = new PlansController(service as any);
    const context = {
      getHandler: () => PlansController.prototype.deletePlan,
      getClass: () => PlansController,
      switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
    } as unknown as ExecutionContext;
    const allowed = new RolesGuard(new Reflector()).canActivate(context);
    expect(allowed).toBe(role === Role.SUPER_ADMIN);
    if (allowed) await controller.deletePlan('plan-b');
    expect(service.deletePlan).toHaveBeenCalledTimes(role === Role.SUPER_ADMIN ? 1 : 0);
  });
});
