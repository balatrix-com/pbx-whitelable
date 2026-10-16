import { Injectable, ForbiddenException, NotFoundException, BadRequestException, Optional, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, UserStatus, UserAuditAction } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { InviteSupportUserDto } from './dto/invite-support-user.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';

import { KamailioDBService } from '../freeswitch/kamailio-db.service';
import { MailService } from '../mail/mail.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class UsersService {
    private readonly logger = new Logger(UsersService.name);

    constructor(
        private prisma: PrismaService,
        private kamailioService: KamailioDBService,
        private mailService: MailService,
        @Optional() private httpService?: HttpService,
        @Optional() private configService?: ConfigService,
    ) { }

    // Helper to create audit log
    private async createAuditLog(
        actorId: string,
        targetId: string | null,
        action: UserAuditAction,
        metadata?: any
    ) {
        await this.prisma.userAuditLog.create({
            data: {
                actorId,
                targetId,
                action,
                metadata: metadata || {}
            }
        });
    }

    // Helper to check if admin can manage a user
    private async canManageUser(adminId: string, targetUserId: string): Promise<boolean> {
        const admin = await this.prisma.user.findUnique({
            where: { id: adminId },
            include: { managedSupportUsers: true }
        });

        if (!admin) return false;
        if (admin.role === Role.SUPER_ADMIN) return true;

        if (admin.role === Role.ADMIN) {
            if (!admin.tenantId) return false;
            // ADMIN can manage any user in their tenant
            const target = await this.prisma.user.findUnique({
                where: { id: targetUserId },
                select: { tenantId: true }
            });

            return !!target && target.tenantId === admin.tenantId;
        }

        return false;
    }

    async listUsers(userId: string, query?: PaginationQueryDto) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) throw new NotFoundException('User not found');

        const page = query?.page || 1;
        const limit = Math.min(query?.limit || 20, 100);
        const skip = (page - 1) * limit;

        // Build where clause
        const where: any = {};

        if (user.role === Role.ADMIN) {
            // ADMIN sees all users in their tenant
            if (user.tenantId) {
                where.tenantId = user.tenantId;
            } else {
                // Should not happen for valid admins, but safe fallback
                where.tenantId = 'NON_EXISTENT'; // Return nothing
            }
        }
        // SUPER_ADMIN sees all users (no where clause restriction)

        // Apply filters
        if (query?.search) {
            where.OR = [
                { email: { contains: query.search, mode: 'insensitive' } },
                { name: { contains: query.search, mode: 'insensitive' } }
            ];
        }

        if (query?.status) {
            where.status = query.status;
        }

        if (query?.role) {
            where.role = query.role;
        }

        // SUPER_ADMIN can filter by tenant
        if (query?.tenantId && user.role === Role.SUPER_ADMIN) {
            if (query.tenantId === 'null') {
                where.tenantId = null;
            } else {
                where.tenantId = query.tenantId;
            }
        }

        if (user.role !== Role.SUPER_ADMIN && user.role !== Role.ADMIN) {
            throw new ForbiddenException('Insufficient permissions');
        }

        // Get total count
        const total = await this.prisma.user.count({ where });

        // Get paginated users
        const users = await this.prisma.user.findMany({
            where,
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                status: true,
                monitoringEnabled: true,
                monitoringExtension: true,
                monitoringSecret: true,
                tenantId: true,
                inviteToken: true,
                inviteTokenExpiry: true,
                tenant: user.role === Role.SUPER_ADMIN ? {
                    select: {
                        id: true,
                        name: true,
                    }
                } : false,
                createdAt: true,
                updatedAt: true
            },
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' }
        });

        return {
            data: users,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async createSupportUser(adminId: string, dto: { email: string; password: string; name?: string }) {
        const admin = await this.prisma.user.findUnique({
            where: { id: adminId }
        });

        if (!admin) throw new NotFoundException('Admin user not found');
        if (admin.role !== Role.ADMIN && admin.role !== Role.SUPER_ADMIN) {
            throw new ForbiddenException('Only administrators can create support users');
        }
        if (admin.role === Role.ADMIN && !admin.tenantId) {
            throw new ForbiddenException('Admin must belong to a tenant');
        }

        // Check if email already exists
        const existing = await this.prisma.user.findUnique({
            where: { email: dto.email }
        });

        if (existing) {
            throw new BadRequestException('Email already in use');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(dto.password, 10);

        // Determine tenantId
        const tenantId = admin.tenantId;

        // Restriction: Only 1 support user per tenant
        const existingSupport = await this.prisma.user.findFirst({
            where: {
                tenantId,
                role: Role.SUPPORT
            }
        });

        if (existingSupport) {
            throw new BadRequestException('This tenant already has a support user. Only one support user is allowed per tenant.');
        }

        // Create support user
        const supportUser = await this.prisma.user.create({
            data: {
                email: dto.email,
                password: hashedPassword,
                name: dto.name,
                role: Role.SUPPORT,
                status: UserStatus.ACTIVE,
                tenantId
            }
        });

        // Create support profile
        await this.prisma.supportProfile.create({
            data: {
                adminUserId: adminId,
                supportUserId: supportUser.id,
                monitoringEnabled: false
            }
        });

        // Audit log
        await this.createAuditLog(adminId, supportUser.id, UserAuditAction.CREATE_USER, {
            email: dto.email,
            role: Role.SUPPORT
        });

        return {
            id: supportUser.id,
            email: supportUser.email,
            name: supportUser.name,
            role: supportUser.role,
            status: supportUser.status,
            tenantId: supportUser.tenantId,
            createdAt: supportUser.createdAt
        };
    }



    async updateUserStatus(actorId: string, targetUserId: string, status: UserStatus) {
        const canManage = await this.canManageUser(actorId, targetUserId);
        if (!canManage) {
            throw new ForbiddenException('You do not have permission to manage this user');
        }

        const targetUser = await this.prisma.user.findUnique({
            where: { id: targetUserId }
        });

        if (!targetUser) throw new NotFoundException('User not found');

        // Update status
        const updateData: any = { status };
        if (status !== UserStatus.ACTIVE) updateData.refreshToken = null;
        if (status === UserStatus.ACTIVE && targetUser.status === UserStatus.INVITED) {
            updateData.inviteToken = null;
            updateData.inviteTokenExpiry = null;
        }

        const updated = await this.prisma.user.update({
            where: { id: targetUserId },
            data: updateData
        });

        // Audit log
        const action = status === UserStatus.SUSPENDED ? UserAuditAction.SUSPEND_USER :
            status === UserStatus.ACTIVE ? UserAuditAction.ACTIVATE_USER :
                UserAuditAction.DELETE_USER;

        await this.createAuditLog(actorId, targetUserId, action, {
            previousStatus: targetUser.status,
            newStatus: status
        });

        return {
            id: updated.id,
            email: updated.email,
            status: updated.status
        };
    }

    private async syncMonitoringToSubBilling(
        tenantId: string,
        monitoring: Array<{ extensionNumber: string; userName?: string; userEmail?: string }>
    ) {
        if (!this.httpService) return;
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { subBillingCustomerId: true }
        });
        if (!tenant?.subBillingCustomerId) return;

        const subscription = await this.prisma.subscription.findFirst({
            where: { tenantId, status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' }
        });
        if (!subscription?.subBillingSubscriptionId) return;

        const subBilling = this.configService?.get<any>('subBilling');
        const apiUrl = subBilling?.apiUrl || process.env.SUB_BILLING_API_URL || 'http://localhost:5005/api';
        const endpoint = `${apiUrl}/pbx/sync-assets/${subscription.subBillingSubscriptionId}`;

        await lastValueFrom(
            this.httpService.post(
                endpoint,
                { monitoring },
                { headers: { 'x-pbx-customer-id': tenant.subBillingCustomerId } }
            )
        );
        this.logger.log(`Synced monitoring extension(s) for tenant ${tenantId} to sub-billing`);
    }

    private async unassignMonitoringFromSubBilling(tenantId: string, extensionNumbers: string[]) {
        if (!this.httpService) return;
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { subBillingCustomerId: true }
        });
        if (!tenant?.subBillingCustomerId) return;

        const subscription = await this.prisma.subscription.findFirst({
            where: { tenantId, status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' }
        });
        if (!subscription?.subBillingSubscriptionId) return;

        const subBilling = this.configService?.get<any>('subBilling');
        const apiUrl = subBilling?.apiUrl || process.env.SUB_BILLING_API_URL || 'http://localhost:5005/api';
        const endpoint = `${apiUrl}/pbx/unassign-assets`;

        await lastValueFrom(
            this.httpService.post(
                endpoint,
                {
                    subscriptionId: subscription.subBillingSubscriptionId,
                    monitoring: extensionNumbers
                },
                { headers: { 'x-pbx-customer-id': tenant.subBillingCustomerId } }
            )
        );
        this.logger.log(`Unassigned monitoring extension(s) ${extensionNumbers.join(', ')} for tenant ${tenantId} in sub-billing`);
    }

    async updatePermissions(
        actorId: string,
        targetUserId: string,
        monitoringEnabled: boolean,
        monitoringExtension?: string,
        monitoringSecret?: string,
        name?: string
    ) {
        const canManage = await this.canManageUser(actorId, targetUserId);
        if (!canManage) {
            throw new ForbiddenException('You do not have permission to manage this user');
        }

        const targetUser = await this.prisma.user.findUnique({
            where: { id: targetUserId }
        });
        if (!targetUser) throw new NotFoundException('User not found');

        const oldMonitoringExt = targetUser.monitoringExtension;

        // Validate extension uniqueness if provided
        if (monitoringEnabled && monitoringExtension) {
            const existing = await this.prisma.user.findFirst({
                where: {
                    monitoringExtension,
                    id: { not: targetUserId }
                }
            });
            if (existing) {
                throw new BadRequestException(`Extension ${monitoringExtension} is already assigned to another user`);
            }

            // Prevent collision with standard extensions
            const existingExtension = await this.prisma.extension.findFirst({
                where: {
                    extensionNumber: monitoringExtension
                }
            });
            if (existingExtension) {
                throw new BadRequestException(`Extension ${monitoringExtension} is already in use as a standard extension`);
            }
        }

        // Sync with Sub-Billing
        if (targetUser.tenantId) {
            if (monitoringEnabled && monitoringExtension) {
                if (oldMonitoringExt && oldMonitoringExt !== monitoringExtension) {
                    await this.unassignMonitoringFromSubBilling(targetUser.tenantId, [oldMonitoringExt]);
                }
                await this.syncMonitoringToSubBilling(targetUser.tenantId, [{
                    extensionNumber: monitoringExtension,
                    userName: name || targetUser.name || undefined,
                    userEmail: targetUser.email
                }]);
            } else if (!monitoringEnabled && oldMonitoringExt) {
                await this.unassignMonitoringFromSubBilling(targetUser.tenantId, [oldMonitoringExt]);
            }
        }

        // Update User directly
        const updatedUser = await this.prisma.user.update({
            where: { id: targetUserId },
            data: {
                monitoringEnabled,
                monitoringExtension: monitoringExtension === undefined ? undefined : monitoringExtension,
                monitoringSecret: monitoringSecret === undefined ? undefined : monitoringSecret,
                name: name === undefined ? undefined : name,
            }
        });

        // Sync with Kamailio
        try {
            if (monitoringEnabled && updatedUser.monitoringExtension && updatedUser.monitoringSecret) {
                if (oldMonitoringExt && oldMonitoringExt !== updatedUser.monitoringExtension) {
                    await this.kamailioService.deleteSubscriber(oldMonitoringExt);
                }
                await this.kamailioService.syncSubscriber(updatedUser.monitoringExtension, updatedUser.monitoringSecret);
            } else if (!monitoringEnabled && oldMonitoringExt) {
                // If monitoring is disabled, remove the SIP account
                await this.kamailioService.deleteSubscriber(oldMonitoringExt);
            }
        } catch (error) {
            this.logger.error(`Failed to sync monitoring extension to Kamailio: ${error.message}`);
            throw error;
        }

        // Audit log
        await this.createAuditLog(actorId, targetUserId, UserAuditAction.UPDATE_USER, {
            field: 'monitoringEnabled',
            newValue: monitoringEnabled,
            monitoringExtension: updatedUser.monitoringExtension
        });

        return {
            userId: targetUserId,
            monitoringEnabled: updatedUser.monitoringEnabled,
            monitoringExtension: updatedUser.monitoringExtension
        };
    }

    async deleteUser(actorId: string, targetUserId: string) {
        const canManage = await this.canManageUser(actorId, targetUserId);
        if (!canManage) {
            throw new ForbiddenException('You do not have permission to delete this user');
        }

        const targetUser = await this.prisma.user.findUnique({
            where: { id: targetUserId }
        });

        if (!targetUser) throw new NotFoundException('User not found');

        // If user had an active monitoring extension, clean up from Sub-Billing and Kamailio
        if (targetUser.monitoringEnabled && targetUser.monitoringExtension) {
            try {
                if (targetUser.tenantId) {
                    await this.unassignMonitoringFromSubBilling(targetUser.tenantId, [targetUser.monitoringExtension]);
                }
                await this.kamailioService.deleteSubscriber(targetUser.monitoringExtension);
            } catch (err: any) {
                this.logger.error(`Error cleaning up monitoring extension for deleted user ${targetUserId}: ${err.message}`);
            }
        }

        // Hard Delete with manual cascade
        await this.prisma.$transaction(async (prisma) => {
            // 1. Delete Support Profile (if exists)
            await prisma.supportProfile.deleteMany({
                where: { supportUserId: targetUserId }
            });

            // 2. Delete Audit Logs where user is actor (or target if necessary)
            // Ideally we'd keep them but set to null, but schema might restrict. 
            // For Safety/Simplicity in dev: delete logs involving this user to clear DB state as requested
            await prisma.userAuditLog.deleteMany({
                where: {
                    OR: [
                        { actorId: targetUserId },
                        { targetId: targetUserId }
                    ]
                }
            });

            // 3. Delete the User
            await prisma.user.delete({
                where: { id: targetUserId }
            });
        });

        // Audit log (target is now null because user is gone)
        // We need to bypass createAuditLog's relation check or simple pass null target
        // But createAuditLog likely expects existing target.
        // Let's create a raw audit log entry manually if needed, or just skip logging the deletion of the deleted user's logs
        // Actually, we can log the action with the *actor* but targetId as null.

        await this.prisma.userAuditLog.create({
            data: {
                actorId,
                targetId: null, // User is gone
                action: UserAuditAction.DELETE_USER,
                metadata: {
                    email: targetUser.email,
                    deletedUserId: targetUserId
                }
            }
        });

        return {
            id: targetUserId,
            status: 'DELETED'
        };
    }


    async getUserActivity(adminId: string, targetUserId: string, query?: { page?: number; limit?: number }) {
        // Verify access
        const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
        const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });

        if (!admin || !target) throw new NotFoundException('User not found');

        if (admin.role !== Role.SUPER_ADMIN && admin.role === Role.ADMIN) {
            // Admin can only see their support users
            const supportProfile = await this.prisma.supportProfile.findUnique({
                where: { supportUserId: targetUserId }
            });

            if (!supportProfile || supportProfile.adminUserId !== adminId) {
                throw new ForbiddenException('You can only view activity of your supported users');
            }

            if (!supportProfile && adminId !== targetUserId) {
                throw new ForbiddenException('Access denied');
            }
        }

        const page = query?.page || 1;
        const limit = Math.min(query?.limit || 20, 100);
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            this.prisma.userAuditLog.findMany({
                where: {
                    OR: [
                        { actorId: targetUserId },
                        { targetId: targetUserId }
                    ]
                },
                include: {
                    actor: {
                        select: { email: true, role: true }
                    }
                },
                orderBy: { timestamp: 'desc' },
                skip,
                take: limit
            }),
            this.prisma.userAuditLog.count({
                where: {
                    OR: [
                        { actorId: targetUserId },
                        { targetId: targetUserId }
                    ]
                }
            })
        ]);

        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async inviteSupportUser(adminId: string, dto: InviteSupportUserDto) {
        const admin = await this.prisma.user.findUnique({
            where: { id: adminId },
            include: { tenant: true }
        });

        if (!admin) throw new NotFoundException('Admin not found');

        if (admin.role !== Role.ADMIN && admin.role !== Role.SUPER_ADMIN) {
            throw new ForbiddenException('Only administrators can invite support users');
        }
        if (admin.role === Role.ADMIN && !admin.tenantId) {
            throw new ForbiddenException('Admin must belong to a tenant');
        }

        // Check if user exists
        const existingUser = await this.prisma.user.findUnique({
            where: { email: dto.email.toLowerCase() }
        });

        if (existingUser) {
            throw new BadRequestException('User already exists');
        }

        // Restriction: Only 1 support user per tenant
        const existingSupport = await this.prisma.user.findFirst({
            where: {
                tenantId: admin.tenantId,
                role: Role.SUPPORT
            }
        });

        if (existingSupport) {
            throw new BadRequestException('This tenant already has a support user. Only one support user is allowed per tenant.');
        }

        // Generate invite token
        const inviteToken = crypto.randomBytes(32).toString('hex');
        const inviteTokenExpiry = new Date();
        inviteTokenExpiry.setDate(inviteTokenExpiry.getDate() + 7); // 7 days

        // Create support user
        const supportUser = await this.prisma.user.create({
            data: {
                email: dto.email.toLowerCase(),
                name: dto.name,
                password: '', // Will be set on acceptance
                role: Role.SUPPORT,
                status: UserStatus.INVITED,
                tenantId: admin.tenantId,
                inviteToken,
                inviteTokenExpiry,
                supportProfile: {
                    create: {
                        adminUserId: adminId,
                        monitoringEnabled: false
                    }
                }
            }
        });

        // Audit log
        await this.createAuditLog(adminId, supportUser.id, UserAuditAction.INVITE_USER, {
            email: dto.email,
            role: Role.SUPPORT
        });

        // Send Invite Email
        await this.mailService.sendSupportInvitationEmail(
            supportUser.email,
            supportUser.name || '',
            inviteToken,
            admin.name || 'Admin',
            admin.tenant?.name || ''
        ).catch(err => {
            console.error('Failed to send support invitation email:', err.message);
        });

        const frontendUrl = process.env.FRONTEND_URL || 'https://subdev.balatrix.com';
        const inviteLink = `${frontendUrl}/invite/accept?token=${supportUser.inviteToken}`;

        return {
            id: supportUser.id,
            email: supportUser.email,
            inviteToken: supportUser.inviteToken,
            inviteTokenExpiry: supportUser.inviteTokenExpiry,
            inviteLink
        };
    }

    async getInviteLink(actorId: string, targetUserId: string) {
        const canManage = await this.canManageUser(actorId, targetUserId);
        if (!canManage) {
            throw new ForbiddenException('You do not have permission to view this user’s invite link');
        }

        const targetUser = await this.prisma.user.findUnique({
            where: { id: targetUserId },
            select: {
                id: true,
                email: true,
                name: true,
                status: true,
                inviteToken: true,
                inviteTokenExpiry: true,
                role: true,
                tenantId: true
            }
        });

        if (!targetUser) {
            throw new NotFoundException('User not found');
        }

        if (targetUser.status !== UserStatus.INVITED || !targetUser.inviteToken) {
            throw new BadRequestException('User is already active or does not have a pending invitation link');
        }

        if (targetUser.inviteTokenExpiry && targetUser.inviteTokenExpiry < new Date()) {
            throw new BadRequestException('The invitation link has expired. Please generate a new invite.');
        }

        const frontendUrl = process.env.FRONTEND_URL || 'https://subdev.balatrix.com';
        const inviteLink = `${frontendUrl}/invite/accept?token=${targetUser.inviteToken}`;

        return {
            id: targetUser.id,
            email: targetUser.email,
            name: targetUser.name,
            status: targetUser.status,
            inviteToken: targetUser.inviteToken,
            inviteTokenExpiry: targetUser.inviteTokenExpiry,
            inviteLink
        };
    }

    async resendSupportInvite(actorId: string, targetUserId: string) {
        const canManage = await this.canManageUser(actorId, targetUserId);
        if (!canManage) {
            throw new ForbiddenException('You do not have permission to resend invite for this user');
        }

        const admin = await this.prisma.user.findUnique({
            where: { id: actorId },
            include: { tenant: true }
        });
        if (!admin) throw new NotFoundException('Admin not found');

        const targetUser = await this.prisma.user.findUnique({
            where: { id: targetUserId }
        });
        if (!targetUser) throw new NotFoundException('User not found');

        if (targetUser.status === UserStatus.ACTIVE) {
            throw new BadRequestException('User is already active and has accepted the invitation');
        }

        // Generate fresh invite token
        const inviteToken = crypto.randomBytes(32).toString('hex');
        const inviteTokenExpiry = new Date();
        inviteTokenExpiry.setDate(inviteTokenExpiry.getDate() + 7); // 7 days

        const updated = await this.prisma.user.update({
            where: { id: targetUserId },
            data: {
                status: UserStatus.INVITED,
                inviteToken,
                inviteTokenExpiry
            }
        });

        // Audit log
        await this.createAuditLog(actorId, targetUserId, UserAuditAction.INVITE_USER, {
            email: targetUser.email,
            action: 'RESEND_INVITE'
        });

        // Send Email
        await this.mailService.sendSupportInvitationEmail(
            updated.email,
            updated.name || '',
            inviteToken,
            admin.name || 'Admin',
            admin.tenant?.name || ''
        ).catch(err => {
            console.error('Failed to send support invitation email:', err.message);
        });

        const frontendUrl = process.env.FRONTEND_URL || 'https://subdev.balatrix.com';
        const inviteLink = `${frontendUrl}/invite/accept?token=${inviteToken}`;

        return {
            id: updated.id,
            email: updated.email,
            inviteToken: inviteToken,
            inviteTokenExpiry: inviteTokenExpiry,
            inviteLink
        };
    }

    async acceptInvite(token: string, password: string) {
        const user = await this.prisma.user.findUnique({
            where: { inviteToken: token }
        });

        if (!user) {
            throw new NotFoundException('Invalid invite token');
        }

        if (user.status !== UserStatus.INVITED) {
            throw new BadRequestException('Invite already accepted or user not invited');
        }

        if (!user.inviteTokenExpiry || user.inviteTokenExpiry < new Date()) {
            throw new BadRequestException('Invite token has expired');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update user: activate and flush invite tokens
        const accepted = await this.prisma.user.updateMany({
            // Atomic consumption: concurrent requests cannot accept the same invite twice.
            where: { id: user.id, inviteToken: token, status: UserStatus.INVITED, inviteTokenExpiry: { gt: new Date() } },
            data: {
                password: hashedPassword,
                status: UserStatus.ACTIVE,
                inviteToken: null,
                inviteTokenExpiry: null
            }
        });

        if (accepted.count !== 1) {
            throw new BadRequestException('Invalid or expired invitation');
        }

        // Audit log (actor is the user themselves)
        await this.createAuditLog(user.id, user.id, UserAuditAction.ACCEPT_INVITE, {
            email: user.email
        });

        return {
            id: user.id,
            email: user.email,
            status: UserStatus.ACTIVE
        };
    }

    async impersonateUser(superAdminId: string, targetUserId: string) {
        const superAdmin = await this.prisma.user.findUnique({
            where: { id: superAdminId }
        });

        if (!superAdmin || superAdmin.role !== Role.SUPER_ADMIN) {
            throw new ForbiddenException('Only SUPER_ADMIN can impersonate users');
        }

        const targetUser = await this.prisma.user.findUnique({
            where: { id: targetUserId },
            include: { tenant: true }
        });

        if (!targetUser) {
            throw new NotFoundException('Target user not found');
        }

        // Audit log
        await this.createAuditLog(superAdminId, targetUserId, UserAuditAction.IMPERSONATE_USER, {
            targetEmail: targetUser.email,
            targetRole: targetUser.role
        });

        return {
            user: {
                id: targetUser.id,
                email: targetUser.email,
                name: targetUser.name,
                role: targetUser.role,
                tenantId: targetUser.tenantId
            },
            impersonation: {
                originalUserId: superAdminId,
                originalEmail: superAdmin.email,
                startedAt: new Date()
            }
        };
    }

    async resetUserPassword(actorId: string, targetUserId: string, newPassword: string) {
        const canManage = await this.canManageUser(actorId, targetUserId);
        if (!canManage) {
            throw new ForbiddenException("You do not have permission to reset this user's password");
        }

        const targetUser = await this.prisma.user.findUnique({
            where: { id: targetUserId },
        });

        if (!targetUser) throw new NotFoundException('User not found');

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update user: set new password and force change on next login
        await this.prisma.user.update({
            where: { id: targetUserId },
            data: {
                password: hashedPassword,
                forcePasswordChange: true,
                refreshToken: null, // Invalidate existing sessions
            },
        });

        // Audit log
        await this.createAuditLog(actorId, targetUserId, UserAuditAction.RESET_PASSWORD, {
            email: targetUser.email,
            forcedChange: true,
        });

        return {
            message: 'Password reset successfully. User will be required to change it on next login.',
        };
    }
}
