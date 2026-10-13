import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { normalizeAudio } from './normalize-audio';

jest.mock('node:child_process', () => ({ execFile: jest.fn((...args: any[]) => args[args.length - 1](null, '', '')) }));
jest.mock('node:fs/promises', () => ({
    mkdtemp: jest.fn().mockResolvedValue('/dummy/pbx-audio-fixture'),
    writeFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn(),
    stat: jest.fn().mockResolvedValue({ size: 46 }),
    rm: jest.fn().mockResolvedValue(undefined),
}));

describe('Audio decoder boundary (isolated fixtures)', () => {
    const file = { originalname: 'greeting.wav', buffer: Buffer.from('input') } as Express.Multer.File;
    beforeEach(() => {
        jest.clearAllMocks();
        const wav = Buffer.alloc(46);
        wav.write('RIFF', 0); wav.writeUInt32LE(38, 4); wav.write('WAVE', 8);
        wav.write('fmt ', 12); wav.writeUInt32LE(16, 16);
        wav.write('data', 36); wav.writeUInt32LE(2, 40);
        jest.mocked(readFile).mockResolvedValue(wav as any);
    });
    it('restricts input format/protocols and emits a WAV, then cleans scratch files', async () => {
        expect((await normalizeAudio(file)).toString('ascii', 8, 12)).toBe('WAVE');
        expect(execFile).toHaveBeenCalledWith('ffmpeg', expect.arrayContaining(['-protocol_whitelist', 'file,pipe', '-f', 'wav', '-map_metadata', '-1', 'pcm_s16le']), expect.objectContaining({ timeout: 30000 }), expect.any(Function));
        expect(rm).toHaveBeenCalledWith('/dummy/pbx-audio-fixture', { recursive: true, force: true });
    });
    it('rejects a renamed script when decoding fails and cleans scratch files', async () => {
        jest.mocked(execFile).mockImplementationOnce(((...args: any[]) => args[args.length - 1](new Error('Invalid WAV'))) as any);
        await expect(normalizeAudio(file)).rejects.toThrow(BadRequestException);
        expect(readFile).not.toHaveBeenCalled();
        expect(rm).toHaveBeenCalled();
    });
    it('fails closed when FFmpeg is missing', async () => {
        jest.mocked(execFile).mockImplementationOnce(((...args: any[]) => args[args.length - 1](Object.assign(new Error('missing'), { code: 'ENOENT' }))) as any);
        await expect(normalizeAudio(file)).rejects.toThrow(ServiceUnavailableException);
    });
    it('rejects corrupted output rather than storing it', async () => {
        jest.mocked(readFile).mockResolvedValue(Buffer.from('<?php ?>') as any);
        await expect(normalizeAudio(file)).rejects.toThrow(BadRequestException);
    });
});
