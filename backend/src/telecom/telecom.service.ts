import { Injectable, BadRequestException, NotFoundException, ForbiddenException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { TransactionType, TFNStatus } from '@prisma/client';
import { EnforcementService, ServiceState } from '../enforcement/enforcement.service';
import { FreeSwitchSyncService } from '../freeswitch/freeswitch-sync.service';
import { AudioUploadService } from '../freeswitch/audio-upload.service';
import { RecordingStorageService } from '../freeswitch/recording-storage.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { LookupRedisService } from '../redis/lookup-redis.module';
import { AdminService } from '../admin/admin.service';
import { MonitorService } from '../monitor/monitor.service';
import * as crypto from 'crypto';

@Injectable()
export class TelecomService implements OnModuleInit {
    constructor(
        private prisma: PrismaService,
        private walletService: WalletService,
        private enforcementService: EnforcementService,
        private freeswitchSync: FreeSwitchSyncService,
        private audioUploadService: AudioUploadService,
        private recordingStorageService: RecordingStorageService,
        private entitlements: EntitlementsService,
        private lookupRedis: LookupRedisService,
        private adminService: AdminService,
        private monitorService: MonitorService,
    ) { }

    async onModuleInit() {
        // Seed some TFNs if none exist
        const count = await this.prisma.tFN.count();
        if (count === 0) {
            await this.prisma.tFN.createMany({
                data: [
                    { number: '+18005550100', price: 2.00 }, // Default price needed if not in schema default? Schema has default 2.00
                    { number: '+18005550101', price: 2.00 },
                    { number: '+18005550102', price: 2.00 },
                    { number: '+18005550103', price: 5.00 }, // Premium
                ]
            });
            console.log('Seeded TFNs');
        }
    }

    // --- TFN Logic ---

    async searchTFNs() {
        return this.prisma.tFN.findMany({
            where: { status: TFNStatus.AVAILABLE }
        });
    }

    async listTFNs(tenantId: string) {
        return this.prisma.tFN.findMany({
            where: { tenantId }
        });
    }

    async purchaseTFN(tenantId: string, number: string) {
        const state = await this.enforcementService.getServiceState(tenantId);
        if (state === ServiceState.PLAN_EXPIRED) throw new ForbiddenException('Plan expired');
        if (state === ServiceState.WALLET_NEGATIVE) throw new ForbiddenException('Wallet negative');

        // Plan capacity and ownership are enforced by the shared assignment path.
        // A separate wallet debit here was non-atomic with both databases and could
        // charge a tenant for a number that was never assigned.
        return this.adminService.assignNumber('TFN', number, tenantId);
    }

    // --- Extension Logic ---

    async listExtensions(tenantId: string) {
        return this.prisma.extension.findMany({ where: { tenantId } });
    }

    async createExtension(tenantId: string, data: { extensionNumber: string; name: string; sipPassword?: string }) {
        const state = await this.enforcementService.getServiceState(tenantId);
        if (state === ServiceState.PLAN_EXPIRED) throw new ForbiddenException('Plan expired');

        // Validate Extension Number Uniqueness
        const existing = await this.prisma.extension.findFirst({
            where: { tenantId, extensionNumber: data.extensionNumber }
        });
        if (existing) throw new BadRequestException(`Extension ${data.extensionNumber} already exists`);

        const extension = await this.entitlements.withAvailableSlot(tenantId, 'extensions', tx =>
            tx.extension.create({ data: {
                tenantId,
                extensionNumber: data.extensionNumber,
                name: data.name,
                sipUsername: data.extensionNumber,
                sipPassword: data.sipPassword || crypto.randomBytes(24).toString('base64url'),
            } })
        );
        await this.freeswitchSync.syncExtension(extension.id);
        await this.lookupRedis.updateExtensionLookup(tenantId);
        return extension;
    }

    // --- Monitoring Add-on Logic ---

    async purchaseMonitoring(tenantId: string) {
        const existing = await this.prisma.monitoringAddOn.findUnique({ where: { tenantId } });
        if (existing && existing.isActive) throw new BadRequestException('Monitoring already active');

        // Price
        const PRICE = 5.00; // Hardcoded or config

        try {
            await this.walletService.adjustBalance(tenantId, PRICE, TransactionType.DEBIT, 'Purchase Monitoring Add-on', 'MONITORING-ADDON');
        } catch (err) {
            throw new ForbiddenException('Insufficient funds for Monitoring');
        }

        if (existing) {
            return this.prisma.monitoringAddOn.update({
                where: { tenantId },
                data: { isActive: true }
            });
        } else {
            return this.prisma.monitoringAddOn.create({
                data: {
                    tenantId,
                    price: PRICE
                }
            });
        }
    }

    async getMonitoringStatus(tenantId: string) {
        const calls = await this.monitorService.getActiveCalls(tenantId);
        return {
            active: true,
            activeCalls: calls.length,
            // Queue membership is not tracked by the live-call Redis updater.
            queues: [],
        };
    }

    // --- Call Recording Logic ---

    async getRecordingStatus(tenantId: string) {
        const feature = await this.prisma.tenantFeature.findUnique({ where: { tenantId } });
        return { 
            enabled: feature?.recordingEnabled ?? false,
            allowed: feature?.recordingAllowed ?? false
        };
    }

    async toggleRecording(tenantId: string, enabled: boolean) {
        let feature = await this.prisma.tenantFeature.findUnique({ where: { tenantId } });
        
        if (enabled && (!feature || !feature.recordingAllowed)) {
            throw new ForbiddenException('Call recording feature is not allowed for your tenant. Please contact support.');
        }

        if (!feature) {
            feature = await this.prisma.tenantFeature.create({ data: { tenantId, recordingEnabled: enabled } });
        } else {
            feature = await this.prisma.tenantFeature.update({ where: { tenantId }, data: { recordingEnabled: enabled } });
        }

        await this.prisma.extension.updateMany({
            where: { tenantId },
            data: { recordingEnabled: enabled }
        });

        if (enabled) {
            const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
            if (tenant?.customerCode) {
                await this.recordingStorageService.ensureRecordingsDirectory(tenant.customerCode);
            }
        }

        await this.freeswitchSync.syncAllDialplans(tenantId);

        return { success: true, enabled };
    }


    async checkRecording(tenantId: string, callUuid: string): Promise<boolean> {
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant || !tenant.customerCode) return false;
        
        return this.recordingStorageService.checkFileExists(tenant.customerCode, callUuid);
    }

    async streamRecording(tenantId: string, callUuid: string, res: any): Promise<void> {
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant || !tenant.customerCode) {
            res.status(404).send('Not found');
            return;
        }

        await this.recordingStorageService.streamAudio(tenant.customerCode, callUuid, res);
    }

    // --- Routing Interconnection Logic ---

    async getRoutingOptions(tenantId: string) {
        const [extensions, ringGroups, ivrs, schedules, didForwards] = await Promise.all([
            this.prisma.extension.findMany({
                where: { tenantId },
                select: { id: true, name: true, extensionNumber: true }
            }),
            this.prisma.ringGroup.findMany({
                where: { tenantId },
                select: { id: true, name: true }
            }),
            this.prisma.iVR.findMany({
                where: { tenantId },
                select: { id: true, name: true }
            }),
            this.prisma.operationalSchedule.findMany({
                where: { tenantId },
                select: { id: true, name: true }
            }),
            this.prisma.dIDForward.findMany({
                where: { tenantId },
                select: { id: true, name: true, destinationNumber: true }
            })
        ]);

        return {
            extensions,
            ringGroups,
            ivrs,
            schedules,
            didForwards,
        };
    }

    async updateTFNRouting(id: string, tenantId: string, data: {
        routeType?: string;
        routeTargetId?: string;
        forwardEnabled?: boolean;
        forwardNumber?: string;
    }) {
        const tfn = await this.prisma.tFN.findUnique({ where: { id } });
        if (!tfn) throw new NotFoundException('TFN not found');
        if (tfn.tenantId !== tenantId) throw new ForbiddenException('Access denied');

        const effectiveType = data.routeType ?? tfn.routeType;
        const effectiveTarget = data.routeTargetId ?? tfn.routeTargetId;
        const effectiveForward = data.forwardNumber ?? tfn.forwardNumber;
        if (data.routeType !== undefined || data.routeTargetId !== undefined || data.forwardNumber !== undefined) {
            if (effectiveType === 'forward') {
                if (data.routeTargetId) throw new BadRequestException('Forward routes do not use a target ID');
                if (!effectiveForward) throw new BadRequestException('Forward number is required for forward route type');
            } else if (effectiveType) {
                await this.validateRouteTarget(effectiveType, effectiveTarget || '', tenantId);
            } else if (data.routeTargetId) {
                throw new BadRequestException('Route type is required for a target');
            }
        }

        const updated = await this.prisma.tFN.update({
            where: { id, tenantId },
            data: {
                routeType: data.routeType,
                routeTargetId: data.routeType === 'forward' ? null : data.routeTargetId,
                forwardEnabled: data.forwardEnabled,
                forwardNumber: data.forwardNumber
            }
        });

        // Trigger FreeSWITCH Sync
        try {
            await this.freeswitchSync.syncTFN(updated.id);
        } catch (error) {
            console.error(`FreeSWITCH sync failed for TFN ${updated.number}:`, error);
        }

        return updated;
    }

    private async validateRouteTarget(type: string, targetId: string, tenantId: string) {
        let valid = false;
        switch (type) {
            case 'extension':
                const ext = await this.prisma.extension.findFirst({ where: { id: targetId, tenantId } });
                valid = !!ext;
                break;
            case 'ring_group':
                const rg = await this.prisma.ringGroup.findFirst({ where: { id: targetId, tenantId } });
                valid = !!rg;
                break;
            case 'ivr':
                const ivr = await this.prisma.iVR.findFirst({ where: { id: targetId, tenantId } });
                valid = !!ivr;
                break;
            case 'schedule':
                const sched = await this.prisma.operationalSchedule.findFirst({ where: { id: targetId, tenantId } });
                valid = !!sched;
                break;
            case 'forward':
                // targetId not needed for forward, used forwardNumber instead, but if passed:
                valid = true;
                break;
            case 'did_forward':
                const fwd = await this.prisma.dIDForward.findFirst({ where: { id: targetId, tenantId } });
                valid = !!fwd;
                break;
            default:
                throw new BadRequestException(`Invalid route type: ${type}`);
        }

        if (!valid) throw new BadRequestException(`Invalid routing target for type ${type}`);
    }
}
