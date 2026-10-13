import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/** Decode with an explicit demuxer, discard metadata, and store only PCM WAV. */
export async function normalizeAudio(file: Express.Multer.File): Promise<Buffer> {
    const extension = extname(file.originalname).toLowerCase();
    if (!['.wav', '.mp3'].includes(extension) || !file.buffer.length || file.buffer.length > MAX_AUDIO_BYTES) {
        throw new BadRequestException('Upload a WAV or MP3 file up to 10 MB');
    }
    const directory = await mkdtemp(join(tmpdir(), 'pbx-audio-'));
    try {
        const input = join(directory, `input${extension}`);
        const output = join(directory, 'output.wav');
        await writeFile(input, file.buffer, { mode: 0o600 });
        try {
            await run('ffmpeg', [
                '-nostdin', '-hide_banner', '-loglevel', 'error', '-threads', '1',
                '-protocol_whitelist', 'file,pipe', '-f', extension === '.wav' ? 'wav' : 'mp3',
                '-i', input, '-map', '0:a:0', '-vn', '-map_metadata', '-1',
                '-t', '301', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le',
                '-threads', '1', '-f', 'wav', '-y', output,
            ], { timeout: 30000, maxBuffer: 64 * 1024, windowsHide: true });
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                throw new ServiceUnavailableException('Audio processing is unavailable');
            }
            throw new BadRequestException('Invalid audio or audio processing limit exceeded');
        }
        const size = (await stat(output)).size;
        if (size > MAX_AUDIO_BYTES) throw new BadRequestException('Audio is too large');
        const audio = await readFile(output);
        // Walk RIFF chunks; require nonempty PCM audio no longer than five minutes.
        if (audio.length < 12 || audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE') {
            throw new BadRequestException('Invalid processed audio');
        }
        let dataBytes = 0;
        for (let offset = 12; offset + 8 <= audio.length;) {
            const length = audio.readUInt32LE(offset + 4);
            if (offset + 8 + length > audio.length) throw new BadRequestException('Invalid processed audio');
            if (audio.toString('ascii', offset, offset + 4) === 'data') dataBytes += length;
            offset += 8 + length + (length % 2);
        }
        if (!dataBytes || dataBytes > 16000 * 2 * 300) {
            throw new BadRequestException('Audio must be nonempty and at most five minutes long');
        }
        return audio;
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
}
