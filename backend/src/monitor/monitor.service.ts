import { Injectable, Inject, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { REDIS_CLIENT } from '../redis/redis.module';
import type { RedisClientType } from 'redis';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class MonitorService {
    private readonly logger = new Logger(MonitorService.name);

    constructor(
        @Inject(REDIS_CLIENT) private readonly redisClient: RedisClientType,
        private readonly httpService: HttpService,
    ) { }

    /**
     * Get all active calls for a specific tenant
     */
    async getActiveCalls(tenantId: string) {
        try {
            const pattern = `customer:${tenantId}:call:*`;
            const keys = await this.redisClient.keys(pattern);
            const calls = [];

            for (const key of keys) {
                const callData = await this.redisClient.hGetAll(key);

                // Filter only active calls (new, ringing, answered)
                if (['new', 'ringing', 'answered'].includes(callData.call_status)) {
                    calls.push({
                        uuid: callData.uuid,
                        bUuid: callData.b_uuid,
                        caller: callData.caller,
                        callee: callData.callee,
                        status: callData.call_status,
                        destType: callData.dest_type,
                        destValue: callData.dest_value,
                        direction: callData.direction,
                        startTime: callData.start_ts ? new Date(parseInt(callData.start_ts) * 1000) : null,
                        answerTime: callData.answer_ts ? new Date(parseInt(callData.answer_ts) * 1000) : null,
                        duration: callData.duration ? parseInt(callData.duration) : 0,
                    });
                }
            }

            // Sort by start time desc
            return calls.sort((a, b) => (b.startTime?.getTime() || 0) - (a.startTime?.getTime() || 0));

        } catch (error) {
            this.logger.error(`Failed to get active calls for tenant ${tenantId}`, error);
            return [];
        }
    }

    /**
     * Initiate Barge / Whisper / Listen
     */
    async initiateBarge(
        uuid_in: string,
        uuid_out: string,
        adminExtension: string,
        mode: 'barge' | 'listen' | 'whisper'
    ) {
        const url = process.env.BARGE_API_URL || 'http://localhost:8003';
        const apiKey = process.env.BARGE_API_KEY;

        this.logger.log(`Initiating ${mode} on call ${uuid_in} for admin ${adminExtension}`);

        try {
            const response = await firstValueFrom(
                this.httpService.post(
                    `${url}/barge`,
                    {
                        uuid_in,
                        uuid_out,
                        admin_extension: adminExtension,
                        mode,
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'X-API-Key': apiKey,
                        },
                    },
                ),
            );
            return response.data;
        } catch (error) {
            this.logger.error(`Barge API failed: ${error.message}`, error.response?.data);
            throw new Error(error.response?.data?.detail || 'Failed to initiate barge');
        }
    }
}
