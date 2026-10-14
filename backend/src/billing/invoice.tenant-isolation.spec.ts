import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';

describe('Invoice tenant isolation', () => {
    const rows = [
        { id: 'invoice-a', tenantId: 'tenant-a', adjustments: [{ reason: 'A only' }] },
        { id: 'invoice-b', tenantId: 'tenant-b', adjustments: [{ reason: 'B only' }] },
    ];
    let prisma: any;
    let controller: InvoiceController;
    let service: InvoiceService;
    const admin = { role: Role.ADMIN, tenantId: 'tenant-a' };

    beforeEach(() => {
        prisma = { invoice: {
            findUnique: jest.fn(({ where }: any) => Promise.resolve(rows.find(row =>
                row.id === where.id && (where.tenantId === undefined || row.tenantId === where.tenantId)) ?? null)),
            findMany: jest.fn(),
        } };
        service = new InvoiceService(prisma, {} as any);
        controller = new InvoiceController(service);
    });

    it('returns own invoice with adjustments', async () => {
        await expect(controller.findOne('invoice-a', { user: admin })).resolves.toEqual(rows[0]);
    });

    it('conceals foreign and nonexistent invoice IDs', async () => {
        for (const id of ['invoice-b', 'unknown']) {
            await expect(controller.findOne(id, { user: admin })).rejects.toThrow(NotFoundException);
        }
        expect(prisma.invoice.findUnique).toHaveBeenCalledWith({
            where: { id: 'invoice-b', tenantId: 'tenant-a' }, include: { adjustments: true },
        });
    });

    it('preserves explicit SUPER_ADMIN detail access', async () => {
        await expect(service.getInvoice('invoice-b', { role: Role.SUPER_ADMIN, tenantId: null }))
            .resolves.toEqual(rows[1]);
    });

    it('never drops the tenant predicate for a tenant user', async () => {
        await expect(service.getInvoice('invoice-b', { role: Role.ADMIN })).rejects.toThrow(ForbiddenException);
        await expect(service.getInvoices(undefined as any)).rejects.toThrow(ForbiddenException);
        expect(prisma.invoice.findUnique).not.toHaveBeenCalled();
        expect(prisma.invoice.findMany).not.toHaveBeenCalled();
    });
});
