import { Test, TestingModule } from '@nestjs/testing';
import { TenantsService } from './tenants.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from '../admin/admin.service';
import { FreeSwitchSyncService } from '../freeswitch/freeswitch-sync.service';
import { LookupRedisService } from '../redis/lookup-redis.module';
import { WalletService } from '../wallet/wallet.service';
import { ExtensionsService } from '../telecom/extensions/extensions.service';
import { MailService } from '../mail/mail.service';

describe('TenantsService (Status filtering)', () => {
    let service: TenantsService;
    let prisma: any;
    let adminService: any;

    beforeEach(async () => {
        prisma = {
            tenant: {
                findMany: jest.fn().mockResolvedValue([
                    { id: 'T1', name: 'Active Org', status: 'ACTIVE', _count: { users: 2 }, wallet: null }
                ]),
                count: jest.fn().mockResolvedValue(1),
            }
        };

        adminService = {
            getRealTimeBalances: jest.fn().mockResolvedValue([]),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TenantsService,
                { provide: PrismaService, useValue: prisma },
                { provide: AdminService, useValue: adminService },
                { provide: FreeSwitchSyncService, useValue: {} },
                { provide: LookupRedisService, useValue: {} },
                { provide: WalletService, useValue: {} },
                { provide: ExtensionsService, useValue: {} },
                { provide: MailService, useValue: {} },
            ],
        }).compile();

        service = module.get<TenantsService>(TenantsService);
    });

    it('should filter tenants by status when provided', async () => {
        const result = await service.listTenants({ status: 'ACTIVE' });

        expect(prisma.tenant.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    status: 'ACTIVE'
                })
            })
        );
        expect(result.data).toHaveLength(1);
    });

    it('should query without status condition when status is not specified', async () => {
        await service.listTenants({});

        expect(prisma.tenant.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {}
            })
        );
    });
});
