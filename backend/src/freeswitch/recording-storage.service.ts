import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class RecordingStorageService {
    private readonly logger = new Logger(RecordingStorageService.name);
    private readonly basePath = process.env.FS_RECORDING_PATH || '/mnt/freeswitch-recordings/recordings';

    private isWithin(parent: string, candidate: string): boolean {
        const relative = path.relative(parent, candidate);
        return relative !== '' && relative !== '..' &&
            !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
    }

    private getLocalPath(customerCode: string, callUuid: string): string {
        if (!/^[A-Za-z0-9_-]+$/.test(customerCode) ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(callUuid)) {
            throw new Error('Invalid recording identifier');
        }

        const base = path.resolve(this.basePath);
        const customerDir = path.resolve(base, customerCode);
        const file = path.resolve(customerDir, `${callUuid}.mp3`);
        if (!this.isWithin(base, customerDir) || !this.isWithin(customerDir, file)) {
            throw new Error('Recording path escapes tenant directory');
        }

        // Reject symlinks that point into another tenant's directory.
        const realBase = fs.realpathSync.native(base);
        const realCustomerDir = fs.realpathSync.native(customerDir);
        const realFile = fs.realpathSync.native(file);
        if (!this.isWithin(realBase, realCustomerDir) ||
            !this.isWithin(realCustomerDir, realFile) || !fs.statSync(realFile).isFile()) {
            throw new Error('Recording is outside the tenant directory');
        }
        return realFile;
    }

    /**
     * Ensure the recordings directory exists for a customer on the NAS mount
     * @param customerCode - Customer ID
     */
    async ensureRecordingsDirectory(customerCode: string): Promise<void> {
        try {
            const customerDir = path.join(this.basePath, customerCode);

            if (!fs.existsSync(customerDir)) {
                fs.mkdirSync(customerDir, { recursive: true, mode: 0o775 });
                this.logger.log(`Created recordings directory for customer: ${customerDir}`);
            }

            // Ensure FreeSWITCH has ownership and write permissions
            try {
                const { execSync } = require('child_process');
                execSync(`chown -R freeswitch:freeswitch "${customerDir}" 2>/dev/null && chmod -R 775 "${customerDir}" 2>/dev/null`);
            } catch {
                // Ignore if not running on Linux or freeswitch user isn't present
            }
        } catch (error) {
            this.logger.error(`Failed to ensure recordings directory for ${customerCode}: ${error.message}`);
            // Don't throw, just log
        }
    }

    /**
     * Check if a recording file exists on the NAS mount
     * @param customerCode - Authenticated tenant's customer code
     * @param callUuid - Recording call UUID
     */
    async checkFileExists(customerCode: string, callUuid: string): Promise<boolean> {
        try {
            const localPath = this.getLocalPath(customerCode, callUuid);
            return fs.existsSync(localPath);
        } catch (error) {
            this.logger.error(`Failed to check recording file existence: ${error.message}`);
            return false;
        }
    }

    /**
     * Stream a recording file from the NAS mount
     * @param customerCode - Authenticated tenant's customer code
     * @param callUuid - Recording call UUID
     * @param res - Response object
     */
    async streamAudio(customerCode: string, callUuid: string, res: any): Promise<void> {
        try {
            const localPath = this.getLocalPath(customerCode, callUuid);
            const descriptor = fs.openSync(localPath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
            if (!fs.fstatSync(descriptor).isFile()) {
                fs.closeSync(descriptor);
                throw new Error('Recording is not a regular file');
            }

            res.setHeader('Content-Type', 'audio/mpeg'); // Or audio/wav based on file extension
            const filename = path.basename(localPath);
            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

            // Stream directly to response
            const readStream = fs.createReadStream(localPath, { fd: descriptor, autoClose: true });
            readStream.pipe(res);
            
            readStream.on('error', (err) => {
                this.logger.error(`Read stream error: ${err.message}`);
                if (!res.headersSent) res.status(500).send('Internal server error');
            });
        } catch (error) {
            this.logger.error(`Failed to stream recording: ${error.message}`);
            if (!res.headersSent) res.status(404).send('Recording file not found');
        }
    }
}
