import { Injectable, Logger } from '@nestjs/common';
import SftpClient from 'ssh2-sftp-client';

@Injectable()
export class RecordingStorageService {
    private readonly logger = new Logger(RecordingStorageService.name);
    private readonly sftpConfig = {
        host: process.env.FS_RECORDING_HOST || 'localhost',
        port: parseInt(process.env.FS_RECORDING_PORT || '22'),
        username: process.env.FS_RECORDING_USER || 'recordingadmin',
        password: process.env.FS_RECORDING_PASSWORD || 'OnidaMaruti1)',
    };
    private readonly basePath = process.env.FS_RECORDING_BASE_PATH || '/recordings';

    /**
     * Ensure the recordings directory exists for a customer on the NAS
     * @param customerCode - Customer ID
     */
    async ensureRecordingsDirectory(customerCode: string): Promise<void> {
        const sftp = new SftpClient();
        try {
            await sftp.connect(this.sftpConfig);
            const customerDir = `${this.basePath}/${customerCode}`;

            if (!(await sftp.exists(customerDir))) {
                await sftp.mkdir(customerDir, true);
                this.logger.log(`Created recordings directory for customer: ${customerDir}`);
            }

            await sftp.end();
        } catch (error) {
            this.logger.error(`Failed to ensure recordings directory for ${customerCode}: ${error.message}`);
            // Don't throw, just log
        }
    }

    /**
     * Check if a recording file exists on the NAS
     * @param remotePath - Full remote path on NAS
     */
    async checkFileExists(remotePath: string): Promise<boolean> {
        const sftp = new SftpClient();
        try {
            await sftp.connect(this.sftpConfig);
            const exists = await sftp.exists(remotePath);
            await sftp.end();
            return !!exists;
        } catch (error) {
            this.logger.error(`Failed to check recording file existence: ${error.message}`);
            return false;
        }
    }

    /**
     * Stream a recording file from the NAS
     * @param remotePath - Full remote path on NAS
     * @param res - Response object
     */
    async streamAudio(remotePath: string, res: any): Promise<void> {
        const sftp = new SftpClient();
        try {
            await sftp.connect(this.sftpConfig);
            const exists = await sftp.exists(remotePath);
            if (!exists) {
                await sftp.end();
                res.status(404).send('Recording file not found');
                return;
            }

            res.setHeader('Content-Type', 'audio/mpeg'); // Or audio/wav based on file extension
            const parts = remotePath.split('/');
            const filename = parts[parts.length - 1];
            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

            // Stream directly to response
            await sftp.get(remotePath, res);
            await sftp.end();
        } catch (error) {
            this.logger.error(`Failed to stream recording: ${error.message}`);
            await sftp.end();
            if (!res.headersSent) res.status(500).send('Internal server error');
        }
    }
}
