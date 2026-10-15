import {
    Injectable,
    NotFoundException,
    BadRequestException,
    BadGatewayException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExtensionDto, UpdateExtensionDto } from './dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { FreeSwitchSyncService } from '../../freeswitch/freeswitch-sync.service';
import { LookupRedisService } from '../../redis/lookup-redis.module';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { EntitlementsService } from '../../entitlements/entitlements.service';

@Injectable()
export class ExtensionsService {
    private readonly logger = new Logger(ExtensionsService.name);

    constructor(
        private prisma: PrismaService,
        private readonly freeSwitchSync: FreeSwitchSyncService,
        private readonly lookupRedis: LookupRedisService,
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        private readonly entitlements: EntitlementsService,
    ) { }

    private async resolveTenantId(tenantId: string): Promise<string> {
        if (!tenantId) return tenantId;
        const tenant = await this.prisma.tenant.findFirst({
            where: { id: { equals: tenantId, mode: 'insensitive' } },
            select: { id: true }
        });
        return tenant ? tenant.id : tenantId;
    }

    /**
     * Auto-sync any extensions defined in sub-billing assets into PBX DB, Kamailio subscriber table, and FreeSWITCH
     */
    async syncMissingExtensionsFromSubBilling(tenantId: string): Promise<{ created: number; alreadyPresent: number; syncFailed: number }> {
        const targetTenantId = await this.resolveTenantId(tenantId);
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: targetTenantId },
            select: { id: true, customerCode: true, subBillingCustomerId: true }
        });
        if (!tenant?.subBillingCustomerId) throw new BadRequestException('Tenant billing mapping not found');

        const customerId = tenant.subBillingCustomerId;
        const subscription = await this.prisma.subscription.findFirst({
            where: { tenantId: targetTenantId, status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
        });
        if (!subscription?.subBillingSubscriptionId) throw new BadRequestException('Active subscription not found');
        const subBilling = this.configService.get<any>('subBilling');
        const apiUrl = subBilling?.apiUrl || process.env.SUB_BILLING_API_URL || 'http://localhost:5005/api';

        let subBillingAssets: any = null;
        try {
            const response = await lastValueFrom(
                this.httpService.get(`${apiUrl}/pbx/assets/${customerId}`)
            );
            subBillingAssets = response.data;
        } catch (err: any) {
            throw new BadGatewayException('Unable to fetch billing extension assets');
        }

        if (subBillingAssets?.subscriptionId !== subscription.subBillingSubscriptionId ||
            subBillingAssets?.customerId !== customerId || !Array.isArray(subBillingAssets.extensions)) {
            throw new BadGatewayException('Invalid billing extension assets');
        }
        const allowance = await this.entitlements.allowance(targetTenantId);
        const assets = subBillingAssets.extensions.filter((asset: any) => asset.status === 'active');
        if (assets.length > allowance.extensions) throw new BadGatewayException('Billing extension assets exceed entitlement');
        let created = 0;
        let alreadyPresent = 0;
        let syncFailed = 0;

        const existingExtensions = await this.prisma.extension.findMany({
            where: { tenantId: targetTenantId }
        });
        const existingMap = new Map(existingExtensions.map(e => [e.extensionNumber, e]));

        for (const extAsset of assets) {
            let extNum = String(extAsset.extension_number || extAsset.extensionNumber).trim();
            if (!extNum) continue;

            if (!tenant.customerCode || !extNum.startsWith(tenant.customerCode) ||
                !/^\d+$/.test(extNum.slice(tenant.customerCode.length))) {
                throw new BadGatewayException('Billing returned an invalid extension number');
            }

            const existingExt = existingMap.get(extNum);
            if (!existingExt) {
                try {
                    const defaultPassword = crypto.randomBytes(24).toString('base64url');
                    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
                    const sipPasswordPlaintext = crypto.randomBytes(24).toString('base64url');

                    const newExt = await this.entitlements.withAvailableSlot(targetTenantId, 'extensions', tx =>
                        tx.extension.create({ data: {
                            tenantId: targetTenantId,
                            extensionNumber: extNum,
                            name: extAsset.extension_name || `Extension ${extNum}`,
                            password: hashedPassword,
                            sipUsername: extNum,
                            sipPassword: sipPasswordPlaintext,
                            sipAuthRealm: process.env.SIP_SERVER || 'localhost',
                        } })
                    );
                    created++;

                    existingMap.set(extNum, newExt);
                    this.logger.log(`[Auto-Sync] Synced/Upserted extension ${extNum} in PBX DB for tenant ${targetTenantId}`);

                    // Sync to FreeSWITCH & Kamailio
                    await this.freeSwitchSync.syncExtension(newExt.id).catch(err => {
                        syncFailed++;
                        this.logger.warn(`Failed to sync FreeSWITCH/Kamailio for ${extNum}: ${err.message}`);
                    });
                } catch (createErr: any) {
                    this.logger.error(`Error auto-syncing extension ${extNum} for ${targetTenantId}: ${createErr.message}`);
                    throw createErr;
                }
            } else {
                alreadyPresent++;
                // Ensure existing extension is registered in Kamailio subscriber table
                await this.freeSwitchSync.syncExtension(existingExt.id).catch(err => {
                    syncFailed++;
                    this.logger.warn(`Kamailio sync check failed for ${extNum}: ${err.message}`);
                });
            }
        }

        // Sync with Redis Lookup DB
        await this.lookupRedis.updateExtensionLookup(targetTenantId).catch(err => {
            syncFailed++;
            this.logger.warn(`Extension lookup sync failed for tenant ${targetTenantId}: ${err.message}`);
        });
        return { created, alreadyPresent, syncFailed };
    }

    /**
     * Find all extensions for a tenant (pure, high-performance read operation)
     */
    async findAll(tenantId: string) {
        const targetTenantId = await this.resolveTenantId(tenantId);

        return this.prisma.extension.findMany({
            where: { tenantId: targetTenantId },
            include: {
                ringGroupMembers: {
                    include: {
                        ringGroup: {
                            select: { id: true, name: true },
                        },
                    },
                },
            },
            orderBy: { extensionNumber: 'asc' },
        });
    }

    /**
     * Find one extension by ID
     */
    async findOne(tenantId: string, id: string) {
        const targetTenantId = await this.resolveTenantId(tenantId);
        const extension = await this.prisma.extension.findFirst({
            where: { id, tenantId: targetTenantId },
            include: {
                ringGroupMembers: {
                    include: {
                        ringGroup: {
                            select: { id: true, name: true },
                        },
                    },
                },
            },
        });

        if (!extension) {
            throw new NotFoundException('Extension not found');
        }

        return extension;
    }

    /**
     * Create a new extension
     * Includes:
     * - Subscription limit check
     * - SIP credential generation
     * - Hash password
     */
    async create(tenantId: string, dto: CreateExtensionDto) {
        // Enforce system limits
        const limitStr = process.env.SYSTEM_LIMIT_EXTENSIONS;
        if (limitStr) {
            const limit = parseInt(limitStr, 10);
            if (!isNaN(limit)) {
                const count = await this.prisma.extension.count();
                if (count >= limit) {
                    throw new BadRequestException(`Maximum extension limit of ${limit} has been reached.`);
                }
            }
        }

        // We still need Tenant Customer Code just below.

        // 2. Generate Extension Number: {CustomerCode}{Sequence} (e.g. 100101)
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { customerCode: true }
        });

        if (!tenant || !tenant.customerCode) {
            throw new BadRequestException('Tenant configuration missing customer code.');
        }

        // Determine next sequence
        // We can't rely on `count` because deletions might leave gaps, or we want strictly incremental.
        // Let's find the highest extension number for this tenant that matches pattern, or just use count + 1 if simple.
        // User requested "100101", "100102".

        const sipPasswordPlaintext = crypto.randomBytes(24).toString('base64url');
        const hashedPassword = await bcrypt.hash(dto.password, 10);
        const extension = await this.entitlements.withAvailableSlot(tenantId, 'extensions', async tx => {
        const extensionNumber = await this.getNextExtensionNumber(tenantId, tx);

        // Verify uniqueness (paranoid check)
        const checkUnique = await tx.extension.findUnique({
            where: {
                tenantId_extensionNumber: {
                    tenantId,
                    extensionNumber: extensionNumber
                }
            }
        });

        if (checkUnique) {
            // Collision fallback - increment and try once more? Or just fail?
            throw new BadRequestException(`Extension number generation collision: ${extensionNumber}. Please try again.`);
        }

        // 3. Create Extension
        // Generate SIP credentials
        const sipUsername = extensionNumber; // Use extension number as username

        // Note: We are storing the plaintext SIP password in `sipPassword` field as FreeSWITCH needs to know it (or we store hash if using hash auth, but typically plaintext for directory)
        // Actually, freeswitch usually needs the password to authenticate the user. 
        // If we store it, it should probably be encrypted or we assume FS uses it. 
        // The schema has `sipPassword`.
        // Let's store the plaintext one there? Or a hash? 
        // Standard FS uses plain password in directory xml users.
        // So we store `sipPasswordPlaintext` in `sipPassword`.

        return tx.extension.create({
            data: {
                tenantId,
                extensionNumber: extensionNumber, // Enforced format
                name: dto.name,
                password: hashedPassword, // Web UI password
                sipUsername,
                sipPassword: sipPasswordPlaintext,
                sipAuthRealm: process.env.SIP_SERVER || 'localhost',

                // Call forwarding settings
                forwardAllEnabled: dto.forwardAllEnabled || false,
                forwardAllType: dto.forwardAllType,
                forwardAllDestination: dto.forwardAllDestination,

                forwardBusyEnabled: dto.forwardBusyEnabled || false,
                forwardBusyType: dto.forwardBusyType,
                forwardBusyDestination: dto.forwardBusyDestination,

                forwardNoAnswerEnabled: dto.forwardNoAnswerEnabled || false,
                forwardNoAnswerType: dto.forwardNoAnswerType,
                forwardNoAnswerDestination: dto.forwardNoAnswerDestination,
                forwardNoAnswerTimeout: dto.forwardNoAnswerTimeout || 20,

                outboundCallerIdNumber: dto.outboundCallerIdNumber,
            },
        });
        });

        this.logger.log(`Created extension ${extension.extensionNumber} for tenant ${tenantId}`);

        // Sync to FreeSWITCH/Kamailio — non-fatal if unreachable
        try {
            await this.freeSwitchSync.syncExtension(extension.id);
        } catch (syncErr) {
            this.logger.warn(`FreeSWITCH sync failed for new extension ${extension.extensionNumber}: ${syncErr.message}`);
        }

        // Sync with Redis Lookup DB
        await this.lookupRedis.updateExtensionLookup(tenantId);

        // Return extension with plaintext password (only shown once!)
        return {
            ...extension,
            sipPasswordPlaintext, // ⚠️ Only returned on creation
        };
    }

    /**
     * Update extension (cannot change extension number)
     */
    async update(tenantId: string, id: string, dto: UpdateExtensionDto) {
        // Verify ownership
        const extension = await this.prisma.extension.findFirst({
            where: { id, tenantId },
        });

        if (!extension) {
            throw new NotFoundException('Extension not found');
        }

        // Prepare update data
        const updateData: any = {
            name: dto.name,
            forwardAllEnabled: dto.forwardAllEnabled,
            forwardAllType: dto.forwardAllType,
            forwardAllDestination: dto.forwardAllDestination,
            forwardBusyEnabled: dto.forwardBusyEnabled,
            forwardBusyType: dto.forwardBusyType,
            forwardBusyDestination: dto.forwardBusyDestination,
            forwardNoAnswerEnabled: dto.forwardNoAnswerEnabled,
            forwardNoAnswerType: dto.forwardNoAnswerType,
            forwardNoAnswerDestination: dto.forwardNoAnswerDestination,
            forwardNoAnswerTimeout: dto.forwardNoAnswerTimeout,
            outboundCallerIdNumber: dto.outboundCallerIdNumber,
        };

        // Handle Web Password Update (if provided)
        if (dto.password) {
            updateData.password = await bcrypt.hash(dto.password, 10);
        }

        // Handle SIP Password Update (if provided)
        if (dto.sipPassword) {
            updateData.sipPassword = dto.sipPassword; // Store plaintext
        }

        // Update
        const updated = await this.prisma.extension.update({
            where: { id },
            data: updateData,
        });

        this.logger.log(`Updated extension ${extension.extensionNumber}`);

        // Sync with Redis Lookup DB
        await this.lookupRedis.updateExtensionLookup(tenantId);

        // Sync to FreeSWITCH — non-fatal if unreachable
        try {
            await this.freeSwitchSync.syncExtension(updated.id);
        } catch (syncErr) {
            this.logger.warn(`FreeSWITCH sync failed for updated extension ${updated.extensionNumber}: ${syncErr.message}`);
        }

        return updated;
    }

    /**
     * Delete extension
     * Checks if extension is used in ring groups first
     */
    async remove(tenantId: string, id: string) {
        // Verify ownership and fetch tenant for sync
        const extension = await this.prisma.extension.findFirst({
            where: { id, tenantId },
            include: {
                tenant: true,
                ringGroupMembers: true
            },
        });

        if (!extension) {
            throw new NotFoundException('Extension not found');
        }

        // Check if in use
        if (extension.ringGroupMembers.length > 0) {
            throw new BadRequestException(
                'Cannot delete extension. It is a member of one or more ring groups. Remove it from ring groups first.',
            );
        }

        // Integrity Check: Is this extension a target for any TFN?
        const tfnUsage = await this.prisma.tFN.findFirst({
            where: {
                tenantId,
                routeType: 'extension',
                routeTargetId: id
            }
        });
        if (tfnUsage) {
            throw new BadRequestException(`Cannot delete extension. It is currently the routing target for TFN ${tfnUsage.number}.`);
        }

        // Integrity Check: Is this extension a target for any DID?
        const didUsage = await this.prisma.dID.findFirst({
            where: {
                tenantId,
                routeType: 'extension',
                routeTargetId: id
            }
        });
        if (didUsage) {
            throw new BadRequestException(`Cannot delete extension. It is currently the routing target for DID ${didUsage.number}.`);
        }

        // Sync: Delete from FreeSwitch — non-fatal if unreachable
        try {
            await this.freeSwitchSync.deleteExtension(extension);
        } catch (syncErr) {
            this.logger.warn(`FreeSWITCH sync failed for deleted extension ${extension.extensionNumber}: ${syncErr.message}`);
        }

        // Delete
        await this.prisma.extension.delete({ where: { id } });

        // Sync with Redis Lookup DB
        await this.lookupRedis.deleteExtensionLookup(extension.extensionNumber);

        this.logger.log(`Deleted extension ${extension.extensionNumber} for tenant ${tenantId}`);

        return { message: 'Extension deleted successfully' };
    }

    async getNextExtensionNumber(tenantId: string, db: any = this.prisma): Promise<string> {
        const tenant = await db.tenant.findUnique({
            where: { id: tenantId },
            select: { customerCode: true }
        });

        if (!tenant || !tenant.customerCode) {
            throw new BadRequestException('Tenant configuration missing customer code.');
        }

        const pattern = new RegExp(`^${tenant.customerCode}(\\d+)$`);
        let maxSequence = 0;

        // Check Extensions Table
        const lastExtension = await db.extension.findFirst({
            where: { tenantId },
            orderBy: { extensionNumber: 'desc' },
        });

        if (lastExtension) {
            const match = lastExtension.extensionNumber.match(pattern);
            if (match) {
                maxSequence = Math.max(maxSequence, parseInt(match[1], 10));
            }
        }

        // Check Users Table (Monitoring Extensions)
        const usersWithExtensions = await db.user.findMany({
            where: {
                tenantId,
                monitoringExtension: { not: null }
            },
            select: { monitoringExtension: true }
        });

        for (const user of usersWithExtensions) {
            if (user.monitoringExtension) {
                const match = user.monitoringExtension.match(pattern);
                if (match) {
                    maxSequence = Math.max(maxSequence, parseInt(match[1], 10));
                }
            }
        }

        const nextSequence = maxSequence + 1;

        // Return fully formatted extension number
        // Format: {CustomerCode}{Sequence} (padded to at least 2 digits)
        const sequenceStr = nextSequence.toString().padStart(2, '0');
        return `${tenant.customerCode}${sequenceStr}`;
    }

    /**
     * Get active registered extensions for a tenant from Kamailio
     */
    async getActiveStatus(tenantId: string) {
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { customerCode: true }
        });

        if (!tenant || !tenant.customerCode) {
            return { online_count: 0, extensions: [] };
        }

        const customerCode = tenant.customerCode.toLowerCase();
        const kamailioHost = this.configService.get<string>('KAMAILIO_RPC_URL') || 'http://127.0.0.1:8080/rpc';

        try {
            const response = await lastValueFrom(
                this.httpService.post(kamailioHost, {
                    jsonrpc: "2.0",
                    method: "ul.dump",
                    id: 1
                })
            );

            const result = response.data?.result;
            if (!result || !result.Domains) {
                return { online_count: 0, extensions: [] };
            }

            const activeExtensions = [];

            for (const domainObj of result.Domains) {
                const aors = domainObj.Domain?.AoRs || [];
                for (const aorObj of aors) {
                    const info = aorObj.Info;
                    if (!info || !info.AoR) continue;

                    const sipUsername = info.AoR.split('@')[0];
                    // Filter: Only include extensions belonging to this tenant
                    if (sipUsername.toLowerCase().startsWith(customerCode)) {
                        const contacts = info.Contacts || [];
                        const devices = contacts.map((c: any) => ({
                            address: c.Contact?.Address,
                            expires_in: c.Contact?.Expires,
                            user_agent: c.Contact?.['User-Agent'],
                            received_from: c.Contact?.Received,
                            transport_socket: c.Contact?.Socket,
                            state: c.Contact?.State
                        }));

                        activeExtensions.push({
                            extension: sipUsername,
                            domain: info.AoR.split('@')[1],
                            aor: info.AoR,
                            devices
                        });
                    }
                }
            }

            return {
                online_count: activeExtensions.length,
                extensions: activeExtensions
            };
        } catch (error) {
            this.logger.error(`Failed to fetch Kamailio extension status: ${error.message}`);
            return { online_count: 0, extensions: [] };
        }
    }
}
