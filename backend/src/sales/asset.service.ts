import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AssetService {
    constructor(private prisma: PrismaService) { }

    /**
     * Atomically reserves assets for a quote using SKIP LOCKED to prevent race conditions.
     * @param type Asset Type (TFN, DID)
     * @param quantity Number of assets to hold
     * @param quoteId Quote ID to associate with
     * @returns Array of reserved Asset IDs
     */
    async holdAssetsSafe(type: 'TFN' | 'DID', quantity: number, quoteId: string): Promise<string[]> {
        // We use a transaction to ensure atomic reservation
        // rawQuery is required for SKIP LOCKED support in Postgres/Prisma

        // Note: Prisma.sql helper is safer for injections, but we need type casting
        // If we were using TFN table specific, we target 'tfns'.

        if (type !== 'TFN') {
            throw new Error('Only TFN supported in this safe implementation MVP');
        }

        return this.prisma.$transaction(async (tx) => {
            const result = await tx.$queryRaw<{ id: string }[]>`
        UPDATE tfns
        SET status = 'HELD',
            "heldBy" = ${quoteId},
            "heldUntil" = NOW() + INTERVAL '7 days'
        WHERE id IN (
          SELECT id
          FROM tfns
          WHERE status = 'AVAILABLE'
          LIMIT ${quantity}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id;
      `;

            // Check if we got enough
            if (result.length < quantity) {
                // Rollback strategy: 
                // In a transaction, throwing an error rolls back the whole thing, 
                // so any partial updates (if any were possible in a single statement) would be undone.
                // Actually, the UPDATE statement is atomic. It updates K rows. 
                // If K < quantity, we should throw to rollback the partial hold.
                throw new ConflictException(`Insufficient inventory. Requested ${quantity}, found ${result.length}`);
            }

            return result.map(r => r.id);
        });
    }

    async releaseAssets(assetIds: string[]) {
        await this.prisma.tFN.updateMany({
            where: { id: { in: assetIds } },
            data: { status: 'AVAILABLE', heldBy: null, heldUntil: null }
        });
    }

    async holdSpecificAssets(numbers: string[], quoteId: string) {
        // Atomic update for specific numbers
        // If concurrency occurs, database locks the rows. Second request sees status!='AVAILABLE' and updates 0 rows.

        if (numbers.length === 0) return;

        return this.prisma.$transaction(async (tx) => {
            const result = await tx.tFN.updateMany({
                where: {
                    number: { in: numbers },
                    status: 'AVAILABLE'
                },
                data: {
                    status: 'HELD',
                    heldBy: quoteId,
                    heldUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                }
            });

            if (result.count !== numbers.length) {
                throw new ConflictException(`One or more requested numbers are unavailable. Secured ${result.count}/${numbers.length}`);
            }
        });
    }
}
