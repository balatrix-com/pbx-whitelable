import { AdminService } from './admin.service';

describe('AdminService - TFN Inventory (Post-Demo Pool Removal)', () => {
    let service: AdminService;
    let prisma: {
        tFN: {
            findMany: jest.Mock;
            create: jest.Mock;
            createMany: jest.Mock;
        };
        dID: {
            findMany: jest.Mock;
        };
    };

    beforeEach(() => {
        prisma = {
            tFN: {
                findMany: jest.fn().mockResolvedValue([
                    {
                        id: 'tfn-1',
                        number: '+18005550100',
                        status: 'AVAILABLE',
                        price: 2.00,
                        tenant: null,
                        purchasedAt: null,
                        createdAt: new Date(),
                    }
                ]),
                create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'tfn-new', ...data })),
                createMany: jest.fn().mockImplementation(({ data }) => Promise.resolve({ count: data.length })),
            },
            dID: {
                findMany: jest.fn().mockResolvedValue([]),
            },
        };

        service = new AdminService(
            prisma as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
        );
    });

    it('should return TFNs with backward-compatible isDemo: false', async () => {
        const result = await service.getAllNumbers();
        expect(result.tfns).toHaveLength(1);
        expect(result.tfns[0].number).toBe('+18005550100');
        expect(result.tfns[0].isDemo).toBe(false);
    });

    it('should create a single TFN without attempting to write isDemo', async () => {
        await service.addTFN({ number: '+18005550101', price: 2.50, isDemo: true });
        expect(prisma.tFN.create).toHaveBeenCalledWith({
            data: {
                number: '+18005550101',
                price: 2.50,
                status: 'AVAILABLE',
            },
        });
    });

    it('should create bulk TFNs without attempting to write isDemo', async () => {
        await service.addTFNBulk({ numbers: ['+18005550102', '+18005550103'], price: 2.00, isDemo: true });
        expect(prisma.tFN.createMany).toHaveBeenCalledWith({
            data: [
                { number: '+18005550102', price: 2.00, status: 'AVAILABLE' },
                { number: '+18005550103', price: 2.00, status: 'AVAILABLE' },
            ],
            skipDuplicates: true,
        });
    });
});
