import { Module } from '@nestjs/common';
import { TelecomService } from './telecom.service';
import { TelecomController } from './telecom.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';
import { EnforcementModule } from '../enforcement/enforcement.module';
import { ExtensionsModule } from './extensions/extensions.module';
import { RingGroupsModule } from './ring-groups/ring-groups.module';
import { IVRsModule } from './ivrs/ivrs.module';
import { AudioModule } from './audio/audio.module';
import { DIDsModule } from './dids/dids.module';
import { OperationalSchedulesModule } from './operational-schedules/operational-schedules.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { FreeswitchModule } from '../freeswitch/freeswitch.module';
import { TFNsModule } from './tfns/tfns.module';
import { DIDForwardsModule } from './did-forwards/did-forwards.module';

@Module({
  imports: [
    PrismaModule,
    WalletModule,
    EnforcementModule,
    ExtensionsModule,
    RingGroupsModule,
    IVRsModule,
    AudioModule,
    DIDsModule,
    OperationalSchedulesModule,
    AnalyticsModule,
    FreeswitchModule,
    TFNsModule,
    DIDForwardsModule,
  ],
  controllers: [TelecomController],
  providers: [TelecomService],
})
export class TelecomModule { }
