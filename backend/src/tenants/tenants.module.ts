
import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { PrismaService } from '../prisma/prisma.service';
import { FreeswitchModule } from '../freeswitch/freeswitch.module';
import { AdminModule } from '../admin/admin.module';
import { LookupRedisModule } from '../redis/lookup-redis.module';
import { WalletModule } from '../wallet/wallet.module';
import { MailModule } from '../mail/mail.module';
import { ExtensionsModule } from '../telecom/extensions/extensions.module';
import { InternalServiceGuard } from '../auth/guards/internal-service.guard';
import { VoicemailModule } from '../voicemail/voicemail.module';

@Module({
    imports: [FreeswitchModule, AdminModule, LookupRedisModule, WalletModule, MailModule, ExtensionsModule, VoicemailModule],
    controllers: [TenantsController],
    providers: [TenantsService, PrismaService, InternalServiceGuard],
    exports: [TenantsService],
})
export class TenantsModule { }
