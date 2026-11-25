import { NotFoundException } from '@nestjs/common';
import { VoicemailService } from './voicemail.service';
import { promises as fs } from 'fs';
import { join } from 'path';

describe('voicemail Audio Library selection', () => {
  function setup(audio: any) {
    const prisma = { audioFile: { findFirst: jest.fn().mockResolvedValue(audio) } };
    const storage = { readAudio: jest.fn().mockResolvedValue(Buffer.from('audio')) };
    const service = new VoicemailService(prisma as any, {} as any, storage as any);
    jest.spyOn(service, 'assertEnabled').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'getBox').mockResolvedValue({ id: 'box' });
    const save = jest.spyOn(service as any, 'saveGreeting').mockResolvedValue({ uploaded: true });
    return { prisma, storage, service, save };
  }

  it('rejects library files that do not belong to the current tenant before reading storage', async () => {
    const { service, prisma, storage } = setup(null);
    await expect(service.selectLibraryGreeting('tenant-1', 'box', 'foreign-audio')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.audioFile.findFirst).toHaveBeenCalledWith({ where: { id: 'foreign-audio', tenantId: 'tenant-1' } });
    expect(storage.readAudio).not.toHaveBeenCalled();
  });

  it('allows one library source to supply multiple mailboxes through the existing conversion path', async () => {
    const { service, storage, save } = setup({ id: 'audio', name: 'Company welcome', size: 100, storageUrl: '/opt/ivr_audio/tenant-1/greeting.mp3' });
    await service.selectLibraryGreeting('tenant-1', 'box-1', 'audio');
    await service.selectLibraryGreeting('tenant-1', 'box-2', 'audio');
    expect(storage.readAudio).toHaveBeenCalledWith('/opt/ivr_audio/tenant-1/greeting.mp3');
    expect(save).toHaveBeenCalledWith('tenant-1', 'box-1', Buffer.from('audio'), 50 * 1024 * 1024,
      { audioFileId: 'audio', audioName: 'Company welcome' });
    expect(save).toHaveBeenCalledWith('tenant-1', 'box-2', Buffer.from('audio'), 50 * 1024 * 1024,
      { audioFileId: 'audio', audioName: 'Company welcome' });
  });
});

describe('voicemail permission enforcement', () => {
  const originalGid = process.env.VOICEMAIL_SHARED_GID;
  afterEach(() => {
    if (originalGid === undefined) delete process.env.VOICEMAIL_SHARED_GID;
    else process.env.VOICEMAIL_SHARED_GID = originalGid;
    jest.restoreAllMocks();
  });

  it('reports a permission error instead of succeeding when group ownership cannot be set', async () => {
    process.env.VOICEMAIL_SHARED_GID = '1005';
    const service = new VoicemailService({} as any, {} as any, {} as any);
    jest.spyOn(fs, 'lstat').mockResolvedValue({ isSymbolicLink: () => false } as any);
    jest.spyOn(fs, 'chown').mockRejectedValue(new Error('EPERM'));
    const chmod = jest.spyOn(fs, 'chmod').mockResolvedValue(undefined);
    await expect((service as any).setPermissions('/greeting.wav', 0o640)).rejects.toMatchObject({ status: 503 });
    expect(chmod).not.toHaveBeenCalled();
  });

  it('sets shared-group ownership and a non-public greeting mode', async () => {
    process.env.VOICEMAIL_SHARED_GID = '1005';
    const service = new VoicemailService({} as any, {} as any, {} as any);
    jest.spyOn(fs, 'lstat').mockResolvedValue({ isSymbolicLink: () => false } as any);
    const chown = jest.spyOn(fs, 'chown').mockResolvedValue(undefined);
    const chmod = jest.spyOn(fs, 'chmod').mockResolvedValue(undefined);
    await (service as any).setPermissions('/greeting.wav', 0o640);
    expect(chown).toHaveBeenCalledWith('/greeting.wav', -1, 1005);
    expect(chmod).toHaveBeenCalledWith('/greeting.wav', 0o640);
  });

  it('sets permissions on the complete greeting and recording paths', async () => {
    const service = new VoicemailService({} as any, {} as any, {} as any);
    jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    const permissions = jest.spyOn(service as any, 'setPermissions').mockResolvedValue(undefined);
    const acl = jest.spyOn(service as any, 'grantFreeSwitchAccess').mockResolvedValue(undefined);
    await (service as any).prepareGreetingDirectory('U1007', 'box-1');
    expect(permissions.mock.calls).toEqual([
      [join('/opt/ivr_audio', 'U1007'), 0o2770],
      [join('/opt/ivr_audio', 'U1007', 'voicemail'), 0o2770],
      [join('/opt/ivr_audio', 'U1007', 'voicemail', 'box-1'), 0o2750],
    ]);
    expect(acl.mock.calls).toEqual([
      ['/opt/ivr_audio', '--x'],
      [join('/opt/ivr_audio', 'U1007'), 'r-x'],
      [join('/opt/ivr_audio', 'U1007', 'voicemail'), 'r-x'],
      [join('/opt/ivr_audio', 'U1007', 'voicemail', 'box-1'), 'r-x'],
    ]);
    permissions.mockClear();
    acl.mockClear();
    await (service as any).prepareIncomingDirectory('U1007', 'box-1');
    expect(permissions.mock.calls).toEqual([
      ['/var/lib/pbx-voicemail', 0o2770],
      [join('/var/lib/pbx-voicemail', 'incoming'), 0o2770],
      [join('/var/lib/pbx-voicemail', 'incoming', 'U1007'), 0o2770],
      [join('/var/lib/pbx-voicemail', 'incoming', 'U1007', 'box-1'), 0o2770],
    ]);
    expect(acl.mock.calls).toEqual([
      ['/var/lib/pbx-voicemail', '--x'],
      [join('/var/lib/pbx-voicemail', 'incoming'), '--x'],
      [join('/var/lib/pbx-voicemail', 'incoming', 'U1007'), '--x'],
      [join('/var/lib/pbx-voicemail', 'incoming', 'U1007', 'box-1'), 'rwx'],
    ]);
  });

  it('does not publish a greeting when a parent directory cannot be shared', async () => {
    const update = jest.fn();
    const service = new VoicemailService({ voicemailBox: { update } } as any, {} as any, {} as any);
    jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'setPermissions').mockRejectedValue(new Error('EPERM'));
    const writeFile = jest.spyOn(fs, 'writeFile');
    await expect((service as any).saveGreeting('U1007', 'box-1', Buffer.from('audio'))).rejects.toThrow('EPERM');
    expect(writeFile).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('does not publish a greeting when FreeSWITCH access cannot be granted', async () => {
    const update = jest.fn();
    const service = new VoicemailService({ voicemailBox: { update } } as any, {} as any, {} as any);
    jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'setPermissions').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'grantFreeSwitchAccess').mockRejectedValue({ status: 503 });
    const writeFile = jest.spyOn(fs, 'writeFile');
    await expect((service as any).saveGreeting('U1008', 'box-1', Buffer.from('audio'))).rejects.toMatchObject({ status: 503 });
    expect(writeFile).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('repairs existing mailbox access when its voicemail page is opened', async () => {
    const box = { id: 'box-1', greetingPath: '/opt/ivr_audio/U1008/voicemail/box-1/greeting.wav' };
    const prisma = { voicemailBox: { findMany: jest.fn().mockResolvedValue([box]) } };
    const service = new VoicemailService(prisma as any, {} as any, {} as any);
    jest.spyOn(service, 'assertEnabled').mockResolvedValue(undefined);
    jest.spyOn(service, 'ensureDefaultBoxes').mockResolvedValue(undefined);
    const incoming = jest.spyOn(service as any, 'prepareIncomingDirectory').mockResolvedValue(undefined);
    const greeting = jest.spyOn(service as any, 'prepareGreetingDirectory').mockResolvedValue(undefined);
    const permissions = jest.spyOn(service as any, 'setPermissions').mockResolvedValue(undefined);
    const acl = jest.spyOn(service as any, 'grantFreeSwitchAccess').mockResolvedValue(undefined);
    await service.listBoxes('U1008');
    await service.listBoxes('U1008');
    expect(incoming).toHaveBeenCalledTimes(1);
    expect(greeting).toHaveBeenCalledTimes(1);
    expect(permissions).toHaveBeenCalledWith(join('/opt/ivr_audio', 'U1008', 'voicemail', 'box-1', 'greeting.wav'), 0o640);
    expect(acl).toHaveBeenCalledWith(join('/opt/ivr_audio', 'U1008', 'voicemail', 'box-1', 'greeting.wav'), 'r--');
  });
});
