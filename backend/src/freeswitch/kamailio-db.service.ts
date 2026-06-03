import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'pg';
import * as crypto from 'crypto';

/**
 * Kamailio Database Service
 * 
 * Manages connection to Kamailio PostgreSQL database.
 * Uses on-demand Client connections to avoid slot exhaustion.
 */
@Injectable()
export class KamailioDBService {
    private readonly logger = new Logger(KamailioDBService.name);
    private readonly realm = 'sip.balatrix.com'; // Hardcoded as per requirement

    private getClient(): Client {
        return new Client({
            host: process.env.FS_DB_HOST,
            port: parseInt(process.env.FS_DB_PORT || '5432', 10),
            database: process.env.KAMAILIO_DB_NAME || 'kamailio',
            user: process.env.FS_DB_USER,
            password: process.env.FS_DB_PASSWORD,
            connectionTimeoutMillis: 5000,
        });
    }

    /**
     * Helper to execute a query with a short-lived connection
     */
    private async executeQuery(text: string, params: any[] = []): Promise<void> {
        const client = this.getClient();
        try {
            await client.connect();
            await client.query(text, params);
        } catch (error) {
            throw error;
        } finally {
            try {
                await client.end();
            } catch (e) {
                // Ignore end errors
            }
        }
    }

    /**
     * Sync Subscriber to Kamailio
     * Calculates HA1/HA1B and upserts into subscriber table
     */
    async syncSubscriber(username: string, passwordPlain: string): Promise<void> {
        // Calculate HA1: MD5(username:realm:password)
        const ha1 = crypto.createHash('md5')
            .update(`${username}:${this.realm}:${passwordPlain}`)
            .digest('hex');

        // HA1B is typically same as HA1 for simple auth schemes
        const ha1b = ha1;

        const query = `
            INSERT INTO subscriber (username, domain, password, ha1, ha1b)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (username, domain)
            DO UPDATE SET
                password = EXCLUDED.password,
                ha1 = EXCLUDED.ha1,
                ha1b = EXCLUDED.ha1b
        `;

        try {
            await this.executeQuery(query, [username, this.realm, passwordPlain, ha1, ha1b]);
            this.logger.log(`Synced Kamailio subscriber: ${username}@${this.realm}`);
        } catch (error) {
            this.logger.error(`Failed to sync Kamailio subscriber ${username}:`, error);
        }
    }

    /**
     * Delete Subscriber from Kamailio
     */
    async deleteSubscriber(username: string): Promise<void> {
        try {
            await this.executeQuery('DELETE FROM subscriber WHERE username = $1 AND domain = $2', [username, this.realm]);
            this.logger.log(`Deleted Kamailio subscriber: ${username}@${this.realm}`);
        } catch (error) {
            this.logger.error(`Failed to delete Kamailio subscriber ${username}:`, error);
        }
    }
}
