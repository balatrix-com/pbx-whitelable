import { Module } from '@nestjs/common';
import { ExtensionsController } from './extensions.controller';
import { ExtensionsService } from './extensions.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { FreeswitchModule } from '../../freeswitch/freeswitch.module';
import { AuthModule } from '../../auth/auth.module';
import { LookupRedisModule } from '../../redis/lookup-redis.module';

@Module({
    imports: [PrismaModule, FreeswitchModule, AuthModule, LookupRedisModule],
    controllers: [ExtensionsController],
    providers: [ExtensionsService],
    exports: [ExtensionsService], // Export for use in other modules (e.g., Ring Groups, DIDs)
})
export class ExtensionsModule { }
