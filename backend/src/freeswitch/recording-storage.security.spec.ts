import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { RecordingStorageService } from './recording-storage.service';

describe('Recording tenant directory', () => {
    const callUuid = '12345678-1234-1234-1234-123456789abc';
    let scratch: string;
    let originalPath: string | undefined;
    let service: RecordingStorageService;

    beforeEach(() => {
        scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'recording-tenant-test-'));
        fs.mkdirSync(path.join(scratch, 'tenant-a'));
        fs.mkdirSync(path.join(scratch, 'tenant-b'));
        fs.writeFileSync(path.join(scratch, 'tenant-a', `${callUuid}.mp3`), 'a-sentinel');
        fs.writeFileSync(path.join(scratch, 'tenant-b', `${callUuid}.mp3`), 'b-sentinel');
        originalPath = process.env.FS_RECORDING_PATH;
        process.env.FS_RECORDING_PATH = scratch;
        service = new RecordingStorageService();
    });

    afterEach(() => {
        if (originalPath === undefined) delete process.env.FS_RECORDING_PATH;
        else process.env.FS_RECORDING_PATH = originalPath;
        fs.rmSync(scratch, { recursive: true, force: true });
    });

    it('finds an owned UUID recording and rejects traversal in either identifier', async () => {
        await expect(service.checkFileExists('tenant-a', callUuid)).resolves.toBe(true);
        await expect(service.checkFileExists('tenant-a', `../tenant-b/${callUuid}`)).resolves.toBe(false);
        await expect(service.checkFileExists('../tenant-b', callUuid)).resolves.toBe(false);
        await expect(service.checkFileExists('tenant-a', `%2e%2e%2ftenant-b%2f${callUuid}`)).resolves.toBe(false);
    });

    it('returns 404 for malformed playback without opening a stream', async () => {
        const response = { headersSent: false, status: jest.fn().mockReturnThis(), send: jest.fn(), setHeader: jest.fn() };
        await service.streamAudio('tenant-a', `../tenant-b/${callUuid}`, response);
        expect(response.status).toHaveBeenCalledWith(404);
        expect(response.setHeader).not.toHaveBeenCalled();
    });

    it('rejects a same-name recording symlink that points into another tenant', async () => {
        const alternate = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
        const link = path.join(scratch, 'tenant-a', `${alternate}.mp3`);
        try {
            fs.symlinkSync(path.join(scratch, 'tenant-b', `${callUuid}.mp3`), link, 'file');
        } catch (error: any) {
            if (error.code === 'EPERM') return; // Windows without symlink privilege
            throw error;
        }
        await expect(service.checkFileExists('tenant-a', alternate)).resolves.toBe(false);
    });
});
