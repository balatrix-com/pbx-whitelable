import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { PaymentsController } from './payments.controller';

@Module({
    imports: [PrismaModule, ConfigModule],
    controllers: [PaymentsController],
    providers: [StripeService],
    exports: [StripeService],
})
export class PaymentsModule { }
