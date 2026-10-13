import { normalizeAudio, MAX_AUDIO_BYTES } from './normalize-audio';
import { BadRequestException } from '@nestjs/common';
describe('Audio input validation', () => {
    it.each(['payload.php', 'payload.svg', 'payload.mp3.php', 'playlist.m3u8'])('rejects %s with forged audio MIME type', async originalname => {
        await expect(normalizeAudio({ originalname, mimetype: 'audio/mpeg', buffer: Buffer.from('<?php echo 1; ?>') } as Express.Multer.File)).rejects.toThrow(BadRequestException);
    });
    it('rejects empty audio', async () => {
        await expect(normalizeAudio({ originalname: 'test.wav', buffer: Buffer.alloc(0) } as Express.Multer.File)).rejects.toThrow(BadRequestException);
    });
    it('rejects oversized audio before decoding', async () => {
        await expect(normalizeAudio({ originalname: 'test.wav', buffer: Buffer.alloc(MAX_AUDIO_BYTES + 1) } as Express.Multer.File)).rejects.toThrow(BadRequestException);
    });
});
