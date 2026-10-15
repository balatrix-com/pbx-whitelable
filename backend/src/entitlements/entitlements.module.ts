import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { EntitlementsService } from './entitlements.service';

@Module({
    imports: [PrismaModule, HttpModule, ConfigModule],
    providers: [EntitlementsService],
    exports: [EntitlementsService],
})
export class EntitlementsModule { }
