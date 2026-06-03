import { Module } from '@nestjs/common';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';
import { WalletModule } from '../wallet/wallet.module';
import { FreeswitchModule } from '../freeswitch/freeswitch.module';
import { LookupRedisModule } from '../redis/lookup-redis.module';

@Module({
    imports: [WalletModule, FreeswitchModule, LookupRedisModule],
    controllers: [DemoController],
    providers: [DemoService],
})
export class DemoModule {}
