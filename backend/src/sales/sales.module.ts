import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { PricingService } from './pricing.service';
import { AssetService } from './asset.service';
import { PrismaModule } from '../prisma/prisma.module';
import { IdempotencyModule } from '../common/idempotency/idempotency.module';

@Module({
    imports: [PrismaModule, IdempotencyModule],
    controllers: [SalesController],
    providers: [SalesService, PricingService, AssetService],
    exports: [SalesService, PricingService, AssetService],
})
export class SalesModule { }
