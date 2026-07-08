import {
    Injectable,
    NotFoundException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExtensionDto, UpdateExtensionDto } from './dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { FreeSwitchSyncService } from '../../freeswitch/freeswitch-sync.service';
import { LookupRedisService } from '../../redis/lookup-redis.module';

@Injectable()
export class ExtensionsService {
    private readonly logger = new Logger(ExtensionsService.name);

    constructor(
        private prisma: PrismaService,
        private readonly freeSwitchSync: FreeSwitchSyncService,
        private readonly lookupRedis: LookupRedisService,
    ) { }

    /**
     * Find all extensions for a tenant
     */
    async findAll(tenantId: string) {
        return this.prisma.extension.findMany({
            where: { tenantId },
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
        const extension = await this.prisma.extension.findFirst({
            where: { id, tenantId },
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

        const extensionNumber = await this.getNextExtensionNumber(tenantId);

        // Verify uniqueness (paranoid check)
        const checkUnique = await this.prisma.extension.findUnique({
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
        const hashedPassword = await bcrypt.hash(dto.password, 10);

        // Generate SIP credentials
        const sipUsername = extensionNumber; // Use extension number as username
        const sipPasswordPlaintext = '123456';

        // Note: We are storing the plaintext SIP password in `sipPassword` field as FreeSWITCH needs to know it (or we store hash if using hash auth, but typically plaintext for directory)
        // Actually, freeswitch usually needs the password to authenticate the user. 
        // If we store it, it should probably be encrypted or we assume FS uses it. 
        // The schema has `sipPassword`.
        // Let's store the plaintext one there? Or a hash? 
        // Standard FS uses plain password in directory xml users.
        // So we store `sipPasswordPlaintext` in `sipPassword`.

        const extension = await this.prisma.extension.create({
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

    async getNextExtensionNumber(tenantId: string): Promise<string> {
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { customerCode: true }
        });

        if (!tenant || !tenant.customerCode) {
            throw new BadRequestException('Tenant configuration missing customer code.');
        }

        const pattern = new RegExp(`^${tenant.customerCode}(\\d+)$`);
        let maxSequence = 0;

        // Check Extensions Table
        const lastExtension = await this.prisma.extension.findFirst({
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
        const usersWithExtensions = await this.prisma.user.findMany({
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

}
