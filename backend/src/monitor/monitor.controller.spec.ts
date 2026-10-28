import { BadRequestException, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MonitorController } from './monitor.controller';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

describe('MonitorController', () => {
    let controller: MonitorController;
    let monitorService: any;
    let reflector: Reflector;
    let rolesGuard: RolesGuard;

    beforeEach(() => {
        monitorService = {
            getActiveCalls: jest.fn().mockResolvedValue([
                { uuid: 'call-1', caller: '1001', callee: '1002', status: 'answered', tenantId: 'U1012' }
            ]),
            verifyCallTenant: jest.fn().mockResolvedValue(true),
            initiateBarge: jest.fn().mockResolvedValue({ status: 'success', message: 'Barged successfully' }),
        };
        controller = new MonitorController(monitorService);
        reflector = new Reflector();
        rolesGuard = new RolesGuard(reflector);
    });

    describe('RolesGuard & Decorator Validation', () => {
        it('has @Roles defined on the controller class with SUPER_ADMIN, ADMIN, and SUPPORT', () => {
            const classRoles = reflector.get<Role[]>(ROLES_KEY, MonitorController);
            expect(classRoles).toBeDefined();
            expect(classRoles).toEqual(expect.arrayContaining([Role.SUPER_ADMIN, Role.ADMIN, Role.SUPPORT]));
        });

        it.each([Role.SUPER_ADMIN, Role.ADMIN, Role.SUPPORT])('allows %s in RolesGuard', (role) => {
            const context = {
                getHandler: () => MonitorController.prototype.getActiveCalls,
                getClass: () => MonitorController,
                switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
            } as unknown as ExecutionContext;
            const canActivate = rolesGuard.canActivate(context);
            expect(canActivate).toBe(true);
        });

        it('rejects USER in RolesGuard', () => {
            const context = {
                getHandler: () => MonitorController.prototype.getActiveCalls,
                getClass: () => MonitorController,
                switchToHttp: () => ({ getRequest: () => ({ user: { role: Role.USER } }) }),
            } as unknown as ExecutionContext;
            const canActivate = rolesGuard.canActivate(context);
            expect(canActivate).toBe(false);
        });
    });

    describe('getActiveCalls - RBAC & Multi-Tenant Isolation', () => {
        it('allows SUPER_ADMIN to query all tenants', async () => {
            const req = { user: { role: Role.SUPER_ADMIN } };
            const result = await controller.getActiveCalls(req, 'all');
            expect(monitorService.getActiveCalls).toHaveBeenCalledWith('all');
            expect(result.calls).toHaveLength(1);
        });

        it('allows SUPER_ADMIN to query a specific tenant', async () => {
            const req = { user: { role: Role.SUPER_ADMIN } };
            const result = await controller.getActiveCalls(req, 'U1012');
            expect(monitorService.getActiveCalls).toHaveBeenCalledWith('U1012');
            expect(result.calls).toHaveLength(1);
        });

        it('allows ADMIN to query their own tenant (U1012)', async () => {
            const req = { user: { role: Role.ADMIN, tenantId: 'U1012' } };
            const result = await controller.getActiveCalls(req, 'U1012');
            expect(monitorService.getActiveCalls).toHaveBeenCalledWith('U1012');
            expect(result.calls).toHaveLength(1);
        });

        it('allows ADMIN to query their own tenant with normalized ID (1012 matching U1012)', async () => {
            const req = { user: { role: Role.ADMIN, tenantId: 'U1012' } };
            const result = await controller.getActiveCalls(req, '1012');
            expect(monitorService.getActiveCalls).toHaveBeenCalledWith('U1012');
            expect(result.calls).toHaveLength(1);
        });

        it('allows ADMIN to query without queryTenantId (defaults to user.tenantId)', async () => {
            const req = { user: { role: Role.ADMIN, tenantId: 'U1012' } };
            const result = await controller.getActiveCalls(req);
            expect(monitorService.getActiveCalls).toHaveBeenCalledWith('U1012');
            expect(result.calls).toHaveLength(1);
        });

        it('rejects ADMIN attempting to query "all" tenants with 403 Forbidden', async () => {
            const req = { user: { role: Role.ADMIN, tenantId: 'U1012' } };
            await expect(controller.getActiveCalls(req, 'all')).rejects.toThrow(ForbiddenException);
            expect(monitorService.getActiveCalls).not.toHaveBeenCalled();
        });

        it('rejects ADMIN attempting to query another tenant (U1005) with 403 Forbidden', async () => {
            const req = { user: { role: Role.ADMIN, tenantId: 'U1012' } };
            await expect(controller.getActiveCalls(req, 'U1005')).rejects.toThrow(ForbiddenException);
            expect(monitorService.getActiveCalls).not.toHaveBeenCalled();
        });

        it('allows SUPPORT with monitoringEnabled: true to query their tenant', async () => {
            const req = { user: { role: Role.SUPPORT, tenantId: 'U1012', monitoringEnabled: true } };
            const result = await controller.getActiveCalls(req, 'U1012');
            expect(monitorService.getActiveCalls).toHaveBeenCalledWith('U1012');
            expect(result.calls).toHaveLength(1);
        });

        it('rejects SUPPORT with monitoringEnabled: false with 403 Forbidden', async () => {
            const req = { user: { role: Role.SUPPORT, tenantId: 'U1012', monitoringEnabled: false } };
            await expect(controller.getActiveCalls(req, 'U1012')).rejects.toThrow(ForbiddenException);
            expect(monitorService.getActiveCalls).not.toHaveBeenCalled();
        });

        it('rejects USER role with 403 Forbidden', async () => {
            const req = { user: { role: Role.USER, tenantId: 'U1012' } };
            await expect(controller.getActiveCalls(req, 'U1012')).rejects.toThrow(ForbiddenException);
            expect(monitorService.getActiveCalls).not.toHaveBeenCalled();
        });
    });

    describe('initiateBarge - RBAC & Ownership Validation', () => {
        it('allows ADMIN to barge on their own tenant call', async () => {
            const req = { user: { role: Role.ADMIN, tenantId: 'U1012' } };
            const body = { uuid_in: 'uuid-1', uuid_out: 'uuid-2', mode: 'barge' as const, adminExtension: 'U101203' };
            const res = await controller.initiateBarge(req, body);
            expect(monitorService.verifyCallTenant).toHaveBeenCalledWith('uuid-1', 'U1012');
            expect(monitorService.initiateBarge).toHaveBeenCalledWith('uuid-1', 'uuid-2', 'U101203', 'barge');
            expect(res.status).toBe('success');
        });

        it('allows SUPPORT with monitoringEnabled: true to barge on their tenant call', async () => {
            const req = { user: { role: Role.SUPPORT, tenantId: 'U1012', monitoringEnabled: true } };
            const body = { uuid_in: 'uuid-1', uuid_out: 'uuid-2', mode: 'listen' as const, adminExtension: 'U101204' };
            const res = await controller.initiateBarge(req, body);
            expect(monitorService.verifyCallTenant).toHaveBeenCalledWith('uuid-1', 'U1012');
            expect(monitorService.initiateBarge).toHaveBeenCalledWith('uuid-1', 'uuid-2', 'U101204', 'listen');
            expect(res.status).toBe('success');
        });

        it('rejects SUPPORT with monitoringEnabled: false with 403 Forbidden', async () => {
            const req = { user: { role: Role.SUPPORT, tenantId: 'U1012', monitoringEnabled: false } };
            const body = { uuid_in: 'uuid-1', uuid_out: 'uuid-2', mode: 'listen' as const, adminExtension: 'U101204' };
            await expect(controller.initiateBarge(req, body)).rejects.toThrow(ForbiddenException);
            expect(monitorService.initiateBarge).not.toHaveBeenCalled();
        });

        it('rejects ADMIN if target call belongs to another tenant', async () => {
            monitorService.verifyCallTenant.mockResolvedValueOnce(false);
            const req = { user: { role: Role.ADMIN, tenantId: 'U1012' } };
            const body = { uuid_in: 'uuid-foreign', uuid_out: 'uuid-2', mode: 'barge' as const, adminExtension: 'U101203' };
            await expect(controller.initiateBarge(req, body)).rejects.toThrow(ForbiddenException);
            expect(monitorService.initiateBarge).not.toHaveBeenCalled();
        });

        it('restricts SUPER_ADMIN to mode "listen" only (rejects "barge" with 400 Bad Request)', async () => {
            const req = { user: { role: Role.SUPER_ADMIN } };
            const body = { uuid_in: 'uuid-1', uuid_out: 'uuid-2', mode: 'barge' as const, adminExtension: '999001' };
            await expect(controller.initiateBarge(req, body)).rejects.toThrow(BadRequestException);
            expect(monitorService.initiateBarge).not.toHaveBeenCalled();
        });

        it('allows SUPER_ADMIN to initiate "listen" with default adminExtension 999001', async () => {
            const req = { user: { role: Role.SUPER_ADMIN } };
            const body = { uuid_in: 'uuid-1', uuid_out: 'uuid-2', mode: 'listen' as const };
            const res = await controller.initiateBarge(req, body);
            expect(monitorService.initiateBarge).toHaveBeenCalledWith('uuid-1', 'uuid-2', '999001', 'listen');
            expect(res.status).toBe('success');
        });

        it('rejects request with missing required fields with 400 Bad Request', async () => {
            const req = { user: { role: Role.ADMIN, tenantId: 'U1012' } };
            const body = { uuid_in: '', uuid_out: 'uuid-2', mode: 'barge' as const, adminExtension: 'U101203' };
            await expect(controller.initiateBarge(req, body)).rejects.toThrow(BadRequestException);
        });

        it('rejects user without tenantId for non-SUPER_ADMIN with 403 Forbidden', async () => {
            const req = { user: { role: Role.ADMIN, tenantId: null } };
            const body = { uuid_in: 'uuid-1', uuid_out: 'uuid-2', mode: 'barge' as const, adminExtension: '1001' };
            await expect(controller.initiateBarge(req, body)).rejects.toThrow(ForbiddenException);
        });
    });
});
