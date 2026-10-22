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

describe('UsersService - Monitoring Permissions Lifecycle', () => {
    let service: UsersService;
    let prisma: any;
    let kamailioDB: any;
    let httpService: any;
    let configService: any;

    const mockAdmin = {
        id: 'admin-1',
        email: 'admin@tenant.com',
        role: Role.ADMIN,
        tenantId: 'tenant-1'
    };

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
                    if (where.id === mockAdmin.id) return Promise.resolve(mockAdmin);
                    if (where.id === mockSupportUser.id) return Promise.resolve({ ...currentUserState });
                    return Promise.resolve(null);
                }),
                findFirst: jest.fn().mockResolvedValue(null),
                update: jest.fn().mockImplementation(({ where, data }) => {
                    currentUserState = { ...currentUserState, ...data };
                    return Promise.resolve({
                        id: where.id,
                        ...currentUserState
                    });
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

    describe('1. Initial Setup for Support User', () => {
        it('should successfully configure monitoring extension U100502 and sync to Kamailio & Sub-Billing', async () => {
            const result = await service.updatePermissions(
                mockAdmin.id,
                mockSupportUser.id,
                true,
                'U100502',
                'Secret123',
                'Dhruv Support'
            );

            expect(result.monitoringEnabled).toBe(true);
            expect(result.monitoringExtension).toBe('U100502');

            // Verify Kamailio subscriber created
            expect(kamailioDB.syncSubscriber).toHaveBeenCalledWith('U100502', 'Secret123');

            // Verify Sub-Billing synced
            expect(httpService.post).toHaveBeenCalledWith(
                'http://localhost:5005/api/pbx/sync-assets/SUB-1005',
                { monitoring: [{ extensionNumber: 'U100502', userName: 'Dhruv Support', userEmail: 'support@tenant.com' }] },
                expect.any(Object)
            );
        });

        it('should throw BadRequestException if enabling for first time without extension or secret', async () => {
            await expect(
                service.updatePermissions(mockAdmin.id, mockSupportUser.id, true)
            ).rejects.toThrow(BadRequestException);
        });

        it('should reject if extension collides with a standard extension', async () => {
            prisma.extension.findFirst.mockResolvedValueOnce({ id: 'ext-standard', extensionNumber: 'U100501' });

            await expect(
                service.updatePermissions(mockAdmin.id, mockSupportUser.id, true, 'U100501', 'Secret123')
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('2. Toggle OFF (Disabling without losing credentials)', () => {
        it('should unassign in Sub-Billing and delete from Kamailio, while keeping extension and secret in DB', async () => {
            currentUserState = {
                ...mockSupportUser,
                monitoringEnabled: true,
                monitoringExtension: 'U100502',
                monitoringSecret: 'Secret123'
            };

            await service.updatePermissions(mockAdmin.id, mockSupportUser.id, false);

            // Subscriber deleted from Kamailio so softphone cannot connect
            expect(kamailioDB.deleteSubscriber).toHaveBeenCalledWith('U100502');

            // Unassigned from Sub-Billing
            expect(httpService.post).toHaveBeenCalledWith(
                'http://localhost:5005/api/pbx/unassign-assets',
                { subscriptionId: 'SUB-1005', monitoring: ['U100502'] },
                expect.any(Object)
            );

            // DB update leaves extension intact (not null) for instant re-activation
            expect(prisma.user.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        monitoringEnabled: false,
                        monitoringExtension: undefined, // preserved
                        monitoringSecret: undefined     // preserved
                    })
                })
            );
        });

        it('should completely flush extension and secret when flushExtension is true', async () => {
            currentUserState = {
                ...mockSupportUser,
                monitoringEnabled: true,
                monitoringExtension: 'U100502',
                monitoringSecret: 'Secret123'
            };

            await service.updatePermissions(mockAdmin.id, mockSupportUser.id, false, undefined, undefined, undefined, true);

            expect(kamailioDB.deleteSubscriber).toHaveBeenCalledWith('U100502');
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
    });

    describe('3. Toggle ON Again (Instant Re-activation without creating new extension)', () => {
        it('should simply re-activate existing extension U100502 in Sub-Billing and Kamailio without demanding new credentials', async () => {
            currentUserState = {
                ...mockSupportUser,
                monitoringEnabled: false,
                monitoringExtension: 'U100502',
                monitoringSecret: 'Secret123'
            };

            // Caller simply calls toggle ON: { monitoringEnabled: true } without passing new extension!
            const result = await service.updatePermissions(mockAdmin.id, mockSupportUser.id, true);

            expect(result.monitoringEnabled).toBe(true);

            // Re-syncs existing U100502 to Kamailio with saved secret
            expect(kamailioDB.syncSubscriber).toHaveBeenCalledWith('U100502', 'Secret123');

            // Re-syncs existing U100502 to Sub-Billing
            expect(httpService.post).toHaveBeenCalledWith(
                'http://localhost:5005/api/pbx/sync-assets/SUB-1005',
                { monitoring: [{ extensionNumber: 'U100502', userName: 'Support Agent', userEmail: 'support@tenant.com' }] },
                expect.any(Object)
            );
        });
    });

    describe('4. Error Handling for Sub-Billing Failures', () => {
        it('should catch Sub-Billing 409 quota errors and throw BadRequestException instead of unhandled 500 error', async () => {
            const axiosError = {
                response: {
                    status: 409,
                    data: { error: 'No unassigned Monitoring entitlement available' }
                },
                message: 'Request failed with status code 409'
            };
            httpService.post.mockReturnValueOnce(throwError(() => axiosError));

            await expect(
                service.updatePermissions(mockAdmin.id, mockSupportUser.id, true, 'U100503', 'Secret123')
            ).rejects.toThrow(BadRequestException);
        });
    });
});
