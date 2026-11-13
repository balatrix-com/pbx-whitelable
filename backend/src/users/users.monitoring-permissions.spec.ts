import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { KamailioDBService } from '../freeswitch/kamailio-db.service';
import { MailService } from '../mail/mail.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { of, throwError } from 'rxjs';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  UsersService — Monitoring Permissions Lifecycle Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Security rule enforced:
 *    Only SUPER_ADMIN can call updatePermissions().
 *    ADMIN or SUPPORT role must receive ForbiddenException regardless of
 *    whether they own the target user's tenant.
 *
 *  Suites:
 *    0. Access Control — SUPER_ADMIN-only gate
 *    1. Initial Setup (SUPER_ADMIN creates extension for support user)
 *    2. Toggle OFF  (disable without losing credentials)
 *    3. Toggle ON   (re-activate existing credentials)
 *    4. Hard Flush  (disable + wipe credentials)
 *    5. Error Handling (sub-billing failures, collisions)
 * ─────────────────────────────────────────────────────────────────────────────
 */
describe('UsersService - Monitoring Permissions Lifecycle', () => {
    let service: UsersService;
    let prisma: any;
    let kamailioDB: any;
    let httpService: any;
    let configService: any;

    // ── Actors ──
    const mockSuperAdmin = {
        id: 'superadmin-1',
        email: 'super@platform.com',
        role: Role.SUPER_ADMIN,
        tenantId: null,
        managedSupportUsers: []
    };

    const mockAdmin = {
        id: 'admin-1',
        email: 'admin@tenant.com',
        role: Role.ADMIN,
        tenantId: 'tenant-1',
        managedSupportUsers: []
    };

    const mockSupportActor = {
        id: 'support-actor-1',
        email: 'support-manager@tenant.com',
        role: Role.SUPPORT,
        tenantId: 'tenant-1',
        managedSupportUsers: []
    };

    // ── Target user (the one getting monitoring configured) ──
    const mockSupportUser = {
        id: 'support-1',
        email: 'support@tenant.com',
        name: 'Support Agent',
        role: Role.SUPPORT,
        tenantId: 'tenant-1',
        monitoringEnabled: false,
        monitoringExtension: null,
        monitoringSecret: null
    };

    let currentUserState: any;

    beforeEach(async () => {
        currentUserState = { ...mockSupportUser };

        prisma = {
            user: {
                findUnique: jest.fn().mockImplementation(({ where }) => {
                    if (where.id === mockSuperAdmin.id) return Promise.resolve(mockSuperAdmin);
                    if (where.id === mockAdmin.id) return Promise.resolve(mockAdmin);
                    if (where.id === mockSupportActor.id) return Promise.resolve(mockSupportActor);
                    if (where.id === mockSupportUser.id) return Promise.resolve({ ...currentUserState });
                    return Promise.resolve(null);
                }),
                findFirst: jest.fn().mockResolvedValue(null),
                update: jest.fn().mockImplementation(({ where, data }) => {
                    currentUserState = { ...currentUserState, ...data };
                    return Promise.resolve({ id: where.id, ...currentUserState });
                }),
            },
            extension: {
                findFirst: jest.fn().mockResolvedValue(null)
            },
            tenant: {
                findUnique: jest.fn().mockResolvedValue({
                    id: 'tenant-1',
                    subBillingCustomerId: 'U1005'
                })
            },
            subscription: {
                findFirst: jest.fn().mockResolvedValue({
                    id: 'sub-1',
                    subBillingSubscriptionId: 'SUB-1005',
                    status: 'ACTIVE'
                })
            },
            userAuditLog: {
                create: jest.fn().mockResolvedValue({})
            }
        };

        kamailioDB = {
            syncSubscriber: jest.fn().mockResolvedValue(undefined),
            deleteSubscriber: jest.fn().mockResolvedValue(undefined)
        };

        httpService = {
            post: jest.fn().mockReturnValue(of({ data: { success: true } }))
        };

        configService = {
            get: jest.fn().mockImplementation((key: string) => {
                if (key === 'subBilling') return { apiUrl: 'http://localhost:5005/api' };
                return null;
            })
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UsersService,
                { provide: PrismaService, useValue: prisma },
                { provide: KamailioDBService, useValue: kamailioDB },
                { provide: MailService, useValue: {} },
                { provide: HttpService, useValue: httpService },
                { provide: ConfigService, useValue: configService }
            ],
        }).compile();

        service = module.get<UsersService>(UsersService);
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // Suite 0 — Access Control: SUPER_ADMIN-only gate
    // ═══════════════════════════════════════════════════════════════════════════
    describe('0. Access Control — Only SUPER_ADMIN may call updatePermissions', () => {

        it('should throw ForbiddenException when actor has ADMIN role tries to enable monitoring', async () => {
            await expect(
                service.updatePermissions(
                    mockAdmin.id,
                    mockSupportUser.id,
                    true,
                    'U100502',
                    'Secret123'
                )
            ).rejects.toThrow(ForbiddenException);

            // Kamailio must NOT be touched
            expect(kamailioDB.syncSubscriber).not.toHaveBeenCalled();
            expect(kamailioDB.deleteSubscriber).not.toHaveBeenCalled();
        });

        it('should throw ForbiddenException when actor has ADMIN role tries to disable monitoring', async () => {
            currentUserState = {
                ...mockSupportUser,
                monitoringEnabled: true,
                monitoringExtension: 'U100502',
                monitoringSecret: 'Secret123'
            };

            await expect(
                service.updatePermissions(mockAdmin.id, mockSupportUser.id, false)
            ).rejects.toThrow(ForbiddenException);

            expect(kamailioDB.deleteSubscriber).not.toHaveBeenCalled();
            expect(prisma.user.update).not.toHaveBeenCalled();
        });

        it('should throw ForbiddenException when actor has ADMIN role tries to re-enable an existing extension', async () => {
            currentUserState = {
                ...mockSupportUser,
                monitoringEnabled: false,
                monitoringExtension: 'U100502',
                monitoringSecret: 'Secret123'
            };

            await expect(
                service.updatePermissions(mockAdmin.id, mockSupportUser.id, true)
            ).rejects.toThrow(ForbiddenException);

            expect(kamailioDB.syncSubscriber).not.toHaveBeenCalled();
        });

        it('should throw ForbiddenException when actor has ADMIN role tries to flush (hard-delete) extension', async () => {
            currentUserState = {
                ...mockSupportUser,
                monitoringEnabled: true,
                monitoringExtension: 'U100502',
                monitoringSecret: 'Secret123'
            };

            await expect(
                service.updatePermissions(
                    mockAdmin.id,
                    mockSupportUser.id,
                    false,
                    undefined,
                    undefined,
                    undefined,
                    true // flushExtension
                )
            ).rejects.toThrow(ForbiddenException);

            expect(prisma.user.update).not.toHaveBeenCalled();
        });

        it('should throw ForbiddenException when actor has SUPPORT role (even same tenant)', async () => {
            await expect(
                service.updatePermissions(
                    mockSupportActor.id,
                    mockSupportUser.id,
                    true,
                    'U100502',
                    'Secret123'
                )
            ).rejects.toThrow(ForbiddenException);
        });

        it('should include the correct error message in ForbiddenException', async () => {
            try {
                await service.updatePermissions(mockAdmin.id, mockSupportUser.id, true, 'U100502', 'Secret123');
                fail('Expected ForbiddenException to be thrown');
            } catch (err) {
                expect(err).toBeInstanceOf(ForbiddenException);
                expect(err.message).toContain('Super Admin');
            }
        });

        it('should allow SUPER_ADMIN to call updatePermissions successfully', async () => {
            const result = await service.updatePermissions(
                mockSuperAdmin.id,
                mockSupportUser.id,
                true,
                'U100502',
                'Secret123',
                'Support Agent'
            );
            expect(result.monitoringEnabled).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // Suite 1 — Initial Setup (SUPER_ADMIN configures monitoring for first time)
    // ═══════════════════════════════════════════════════════════════════════════
    describe('1. Initial Setup — SUPER_ADMIN creates extension for a user', () => {

        it('should configure monitoring extension and sync to Kamailio & Sub-Billing', async () => {
            const result = await service.updatePermissions(
                mockSuperAdmin.id,
                mockSupportUser.id,
                true,
                'U100502',
                'Secret123',
                'Dhruv Support'
            );

            expect(result.monitoringEnabled).toBe(true);
            expect(result.monitoringExtension).toBe('U100502');

            expect(kamailioDB.syncSubscriber).toHaveBeenCalledWith('U100502', 'Secret123');

            expect(httpService.post).toHaveBeenCalledWith(
                'http://localhost:5005/api/pbx/sync-assets/SUB-1005',
                { monitoring: [{ extensionNumber: 'U100502', userName: 'Dhruv Support', userEmail: 'support@tenant.com' }] },
                expect.any(Object)
            );
        });

        it('should throw BadRequestException when enabling for first time without extension or secret', async () => {
            await expect(
                service.updatePermissions(mockSuperAdmin.id, mockSupportUser.id, true)
            ).rejects.toThrow(BadRequestException);

            expect(kamailioDB.syncSubscriber).not.toHaveBeenCalled();
        });

        it('should throw BadRequestException when enabling without a secret on a user that has no saved secret', async () => {
            await expect(
                service.updatePermissions(mockSuperAdmin.id, mockSupportUser.id, true, 'U100502')
            ).rejects.toThrow(BadRequestException);
        });

        it('should reject if extension collides with an already-assigned monitoring extension', async () => {
            prisma.user.findFirst.mockResolvedValueOnce({
                id: 'other-user',
                monitoringExtension: 'U100502'
            });

            await expect(
                service.updatePermissions(mockSuperAdmin.id, mockSupportUser.id, true, 'U100502', 'Secret123')
            ).rejects.toThrow(BadRequestException);

            expect(kamailioDB.syncSubscriber).not.toHaveBeenCalled();
        });

        it('should reject if extension collides with a standard (non-monitoring) extension', async () => {
            prisma.extension.findFirst.mockResolvedValueOnce({
                id: 'ext-standard',
                extensionNumber: 'U100501'
            });

            await expect(
                service.updatePermissions(mockSuperAdmin.id, mockSupportUser.id, true, 'U100501', 'Secret123')
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw NotFoundException when target user does not exist', async () => {
            // SUPER_ADMIN passes the role check and canManageUser() (always true for SUPER_ADMIN),
            // then the service fetches the target user and throws NotFoundException.
            await expect(
                service.updatePermissions(mockSuperAdmin.id, 'non-existent-user', true, 'U100502', 'Secret123')
            ).rejects.toThrow(NotFoundException);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // Suite 2 — Toggle OFF (soft disable — keep credentials for quick re-enable)
    // ═══════════════════════════════════════════════════════════════════════════
    describe('2. Toggle OFF — Disable monitoring while preserving credentials in DB', () => {

        beforeEach(() => {
            currentUserState = {
                ...mockSupportUser,
                monitoringEnabled: true,
                monitoringExtension: 'U100502',
                monitoringSecret: 'Secret123'
            };
        });

        it('should delete SIP subscriber from Kamailio and unassign from Sub-Billing', async () => {
            await service.updatePermissions(mockSuperAdmin.id, mockSupportUser.id, false);

            expect(kamailioDB.deleteSubscriber).toHaveBeenCalledWith('U100502');

            expect(httpService.post).toHaveBeenCalledWith(
                'http://localhost:5005/api/pbx/unassign-assets',
                { subscriptionId: 'SUB-1005', monitoring: ['U100502'] },
                expect.any(Object)
            );
        });

        it('should update DB with monitoringEnabled=false but NOT null out the extension or secret', async () => {
            await service.updatePermissions(mockSuperAdmin.id, mockSupportUser.id, false);

            expect(prisma.user.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        monitoringEnabled: false,
                        // extension and secret are preserved (undefined = not changed)
                        monitoringExtension: undefined,
                        monitoringSecret: undefined
                    })
                })
            );
        });

        it('should NOT call syncSubscriber when disabling', async () => {
            await service.updatePermissions(mockSuperAdmin.id, mockSupportUser.id, false);
            expect(kamailioDB.syncSubscriber).not.toHaveBeenCalled();
        });

        it('should return monitoringEnabled: false', async () => {
            const result = await service.updatePermissions(mockSuperAdmin.id, mockSupportUser.id, false);
            expect(result.monitoringEnabled).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // Suite 3 — Toggle ON (re-activate existing extension without new credentials)
    // ═══════════════════════════════════════════════════════════════════════════
    describe('3. Toggle ON — Re-activate existing extension without passing new credentials', () => {

        beforeEach(() => {
            currentUserState = {
                ...mockSupportUser,
                monitoringEnabled: false,
                monitoringExtension: 'U100502',
                monitoringSecret: 'Secret123'
            };
        });

        it('should re-sync the existing extension to Kamailio with saved secret', async () => {
            await service.updatePermissions(mockSuperAdmin.id, mockSupportUser.id, true);
            expect(kamailioDB.syncSubscriber).toHaveBeenCalledWith('U100502', 'Secret123');
        });

        it('should re-sync the existing extension to Sub-Billing', async () => {
            await service.updatePermissions(mockSuperAdmin.id, mockSupportUser.id, true);

            expect(httpService.post).toHaveBeenCalledWith(
                'http://localhost:5005/api/pbx/sync-assets/SUB-1005',
                {
                    monitoring: [{
                        extensionNumber: 'U100502',
                        userName: 'Support Agent',
                        userEmail: 'support@tenant.com'
                    }]
                },
                expect.any(Object)
            );
        });

        it('should return monitoringEnabled: true and preserve the extension number', async () => {
            const result = await service.updatePermissions(mockSuperAdmin.id, mockSupportUser.id, true);
            expect(result.monitoringEnabled).toBe(true);
            expect(result.monitoringExtension).toBe('U100502');
        });

        it('should throw BadRequestException if user has no saved extension when re-enabling', async () => {
            currentUserState = {
                ...mockSupportUser,
                monitoringEnabled: false,
                monitoringExtension: null,
                monitoringSecret: null
            };

            await expect(
                service.updatePermissions(mockSuperAdmin.id, mockSupportUser.id, true)
            ).rejects.toThrow(BadRequestException);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // Suite 4 — Hard Flush (disable + permanently remove credentials)
    // ═══════════════════════════════════════════════════════════════════════════
    describe('4. Hard Flush — Disable and completely wipe extension credentials', () => {

        beforeEach(() => {
            currentUserState = {
                ...mockSupportUser,
                monitoringEnabled: true,
                monitoringExtension: 'U100502',
                monitoringSecret: 'Secret123'
            };
        });

        it('should null out monitoringExtension and monitoringSecret in DB when flushExtension=true', async () => {
            await service.updatePermissions(
                mockSuperAdmin.id,
                mockSupportUser.id,
                false,
                undefined,
                undefined,
                undefined,
                true // flushExtension
            );

            expect(prisma.user.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        monitoringEnabled: false,
                        monitoringExtension: null,
                        monitoringSecret: null
                    })
                })
            );
        });

        it('should delete SIP subscriber from Kamailio when flushing', async () => {
            await service.updatePermissions(
                mockSuperAdmin.id, mockSupportUser.id, false, undefined, undefined, undefined, true
            );
            expect(kamailioDB.deleteSubscriber).toHaveBeenCalledWith('U100502');
        });

        it('should require fresh extension+secret for next enablement after flush', async () => {
            // After flush, currentUserState has no extension
            await service.updatePermissions(
                mockSuperAdmin.id, mockSupportUser.id, false, undefined, undefined, undefined, true
            );

            // currentUserState is now null'd out
            currentUserState = { ...mockSupportUser, monitoringEnabled: false, monitoringExtension: null, monitoringSecret: null };

            await expect(
                service.updatePermissions(mockSuperAdmin.id, mockSupportUser.id, true)
            ).rejects.toThrow(BadRequestException);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // Suite 5 — Error Handling
    // ═══════════════════════════════════════════════════════════════════════════
    describe('5. Error Handling — Sub-Billing failures and edge cases', () => {

        it('should throw BadRequestException on Sub-Billing 409 quota error (no entitlement available)', async () => {
            const axiosError = {
                response: {
                    status: 409,
                    data: { error: 'No unassigned Monitoring entitlement available' }
                },
                message: 'Request failed with status code 409'
            };
            httpService.post.mockReturnValueOnce(throwError(() => axiosError));

            await expect(
                service.updatePermissions(mockSuperAdmin.id, mockSupportUser.id, true, 'U100503', 'Secret123')
            ).rejects.toThrow(BadRequestException);
        });

        it('should still throw error from Kamailio sync failures (not silently swallowed)', async () => {
            kamailioDB.syncSubscriber.mockRejectedValueOnce(new Error('Kamailio unreachable'));

            await expect(
                service.updatePermissions(
                    mockSuperAdmin.id,
                    mockSupportUser.id,
                    true,
                    'U100502',
                    'Secret123'
                )
            ).rejects.toThrow('Kamailio unreachable');
        });

        it('should write an audit log entry on successful permission update', async () => {
            await service.updatePermissions(
                mockSuperAdmin.id,
                mockSupportUser.id,
                true,
                'U100502',
                'Secret123'
            );

            expect(prisma.userAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        actorId: mockSuperAdmin.id,
                        targetId: mockSupportUser.id
                    })
                })
            );
        });
    });
});
