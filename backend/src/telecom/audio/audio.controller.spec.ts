import { AudioController } from './audio.controller';
import { normalizeAudio } from './normalize-audio';
import { BadRequestException } from '@nestjs/common';
jest.mock('./normalize-audio', () => ({ MAX_AUDIO_BYTES: 10 * 1024 * 1024, normalizeAudio: jest.fn() }));
describe('Audio upload boundary', () => {
    const storage = { uploadAudio: jest.fn().mockResolvedValue('/audio/processed.wav') };
    const prisma = { audioFile: { create: jest.fn().mockImplementation(({ data }) => data) } };
    const controller = new AudioController(storage as any, prisma as any);
    const file = { originalname: 'greeting.mp3', buffer: Buffer.from('input'), mimetype: 'audio/mpeg', size: 5 } as Express.Multer.File;
    beforeEach(() => jest.clearAllMocks());
    it('does not store rejected audio', async () => {
        jest.mocked(normalizeAudio).mockRejectedValue(new BadRequestException());
        await expect(controller.uploadAudio({ tenantId: 'tenant' }, file, 'name')).rejects.toThrow(BadRequestException);
        expect(storage.uploadAudio).not.toHaveBeenCalled();
        expect(prisma.audioFile.create).not.toHaveBeenCalled();
    });
    it('stores only decoded WAV with generated filename and accurate metadata', async () => {
        const output = Buffer.from('decoded-wav');
        jest.mocked(normalizeAudio).mockResolvedValue(output);
        const result = await controller.uploadAudio({ tenantId: 'tenant' }, file, '../../p.php');
        expect(storage.uploadAudio).toHaveBeenCalledWith('tenant', output, expect.stringMatching(/^[a-f0-9-]+\.wav$/));
        expect(result).toMatchObject({ mimeType: 'audio/wav', size: output.length });
    });
});
