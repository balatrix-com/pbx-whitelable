import { BadGatewayException, BadRequestException, NotFoundException } from '@nestjs/common';
import { SipTraceService } from './sip-trace.service';

const event = {
  session_uuid: '06cc594c-e616-46c6-9bc0-aceeae73c3ef', customer_id: 'U1001',
  direction: 'OUTBOUND', caller_number: '1001', destination_number: '15551234567',
  started_at: new Date('2026-10-21T10:00:00Z'), ended_at: new Date('2026-10-21T10:01:00Z'),
  first_leg_received_at: new Date('2026-10-21T10:01:02Z'), a_leg_sip_call_id: 'a@test',
  b_leg_sip_call_ids: ['b@test'], merge_status: 'READY', cdr_export_status: 'COMPLETED', hangup_cause: null,
};

describe('SipTraceService', () => {
  const tenantLookup = jest.fn();
  const service = new SipTraceService({ tenant: { findUnique: tenantLookup } } as any);
  afterEach(() => {
    jest.restoreAllMocks();
    tenantLookup.mockReset();
    (service as any).oversizedCache.clear();
    (service as any).cachedBytes = 0;
  });

  it('merges only indexed A/B legs in timestamp order', async () => {
    jest.spyOn(service as any, 'event').mockResolvedValue(event);
    jest.spyOn(service as any, 'messages').mockResolvedValue([
      { id: '1', callId: 'a@test', timestamp: '2026-10-21T10:00:00Z', timestampMs: 1000, method: 'INVITE', src: 'A:1', dst: 'B:2', captureId: 62, raw: 'INVITE' },
      { id: '2', callId: 'b@test', timestamp: '2026-10-21T10:00:01Z', timestampMs: 2000, method: '200', src: 'B:2', dst: 'A:1', captureId: 62, raw: 'SIP/2.0 200' },
    ]);
    const result = await service.flow(event.session_uuid);
    expect(result.participants).toEqual(['A:1', 'B:2']);
    expect(result.messages.map(message => message.callId)).toEqual(['a@test', 'b@test']);
    expect(result.messages[1].elapsedMs).toBe(1000);
    expect(result.rawMode).toBe('embedded');
    expect(result.messages[0].raw).toBe('INVITE');
  });

  it('includes SIP response, CSeq and SDP labels without exposing packet bodies in the flow', async () => {
    const originalBase = process.env.HOMER_API_BASE_URL;
    const originalToken = process.env.HOMER_API_TOKEN;
    process.env.HOMER_API_BASE_URL = 'http://127.0.0.1:9088';
    process.env.HOMER_API_TOKEN = 'test-token';
    jest.spyOn(service as any, 'event').mockResolvedValue(event);
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, text: async () => JSON.stringify({ data: [{
      id: 'packet-1', protocol_header: { time_seconds: 1792576800, src_ip: '10.0.0.1', src_port: 5060, dst_ip: '10.0.0.2', dst_port: 5080 },
      data_header: { call_id: 'a@test', method: '200' },
      raw: 'SIP/2.0 200 OK\r\nCSeq: 123 INVITE\r\nContent-Type: application/sdp\r\nAuthorization: Digest secret',
    }] }) } as Response);
    try {
      const result = await service.flow(event.session_uuid);
      expect(result.messages[0]).toMatchObject({ method: '200', responseCode: 200, cseqMethod: 'INVITE', hasSdp: true });
      expect(result.messages[0].raw).toContain('Authorization: [REDACTED]');
      expect(result.messages[0].raw).not.toContain('Digest secret');
    } finally {
      if (originalBase === undefined) delete process.env.HOMER_API_BASE_URL;
      else process.env.HOMER_API_BASE_URL = originalBase;
      if (originalToken === undefined) delete process.env.HOMER_API_TOKEN;
      else process.env.HOMER_API_TOKEN = originalToken;
    }
  });

  it('restricts raw message retrieval to the selected event and redacts credentials', async () => {
    jest.spyOn(service as any, 'event').mockResolvedValue(event);
    jest.spyOn(service as any, 'messages').mockResolvedValue([
      { id: 'owned', raw: 'INVITE sip:x SIP/2.0\r\nAuthorization: Digest secret\r\nVia: SIP/2.0/UDP x' },
    ]);
    await expect(service.raw(event.session_uuid, 'other')).rejects.toBeInstanceOf(NotFoundException);
    const result = await service.raw(event.session_uuid, 'owned');
    expect(result.raw).not.toContain('secret');
    expect(result.raw).toContain('Authorization: [REDACTED]');
  });

  it('limits tenant history before applying search and scopes it by the JWT tenant', async () => {
    tenantLookup.mockResolvedValue({ customerCode: 'U1001' });
    const query = jest.fn().mockResolvedValue({ rows: [event] });
    jest.spyOn(service as any, 'db').mockReturnValue({ query });
    const result = await service.tenantList('tenant-1', { search: '1555', page: '1', limit: '25' });
    expect(tenantLookup).toHaveBeenCalledWith({ where: { id: 'tenant-1' }, select: { customerCode: true } });
    expect(query.mock.calls[0][0]).toMatch(/WITH latest AS[\s\S]*customer_id = \$1 AND a_leg_uuid IS NOT NULL[\s\S]*LIMIT 100[\s\S]*WHERE \(\$2 = ''/);
    expect(query.mock.calls[0][0]).toContain("a_leg_json->'variables'->>'billing_customer_id'");
    expect(query.mock.calls[0][1]).toEqual(['U1001', '1555', 26, 0]);
    expect(result.maxVisibleCalls).toBe(100);
  });

  it('only opens a tenant call if it remains in that tenant’s latest 100', async () => {
    tenantLookup.mockResolvedValue({ customerCode: 'U1001' });
    const query = jest.fn().mockResolvedValue({ rows: [] });
    jest.spyOn(service as any, 'db').mockReturnValue({ query });
    await expect(service.flow(event.session_uuid, 'tenant-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(query.mock.calls[0][0]).toMatch(/JOIN latest USING \(session_uuid\)/);
    expect(query.mock.calls[0][0]).toContain('a_leg_uuid IS NOT NULL');
    expect(query.mock.calls[0][0]).toContain("a_leg_json->'variables'->>'billing_customer_id'");
    expect(query.mock.calls[0][1]).toEqual([event.session_uuid, 'U1001']);
  });

  it('rejects malformed session and oversized message identifiers before retrieval', async () => {
    await expect(service.flow('------------------------------------')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.raw(event.session_uuid, 'x'.repeat(513))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('removes mirrored Homer packets while keeping messages from each indexed leg', async () => {
    const originalBase = process.env.HOMER_API_BASE_URL;
    const originalToken = process.env.HOMER_API_TOKEN;
    process.env.HOMER_API_BASE_URL = 'http://127.0.0.1:9088';
    process.env.HOMER_API_TOKEN = 'test-token';
    jest.spyOn(service as any, 'event').mockResolvedValue(event);
    const packet = (id: string, callId: string) => ({ id,
      protocol_header: { time_seconds: 1792576800, src_ip: '10.0.0.1', src_port: 5060,
        dst_ip: '10.0.0.2', dst_port: 5080 },
      data_header: { call_id: callId, method: 'INVITE' }, raw: 'INVITE sip:x SIP/2.0' });
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, text: async () => JSON.stringify({ data: [
      packet('one', 'a@test'), packet('mirror', 'a@test'), packet('two', 'b@test'),
      packet('foreign', 'other@test'),
    ] }) } as Response);
    try {
      const result = await service.flow(event.session_uuid);
      expect(result.messages.map(message => message.id)).toEqual(['one', 'two']);
    } finally {
      if (originalBase === undefined) delete process.env.HOMER_API_BASE_URL;
      else process.env.HOMER_API_BASE_URL = originalBase;
      if (originalToken === undefined) delete process.env.HOMER_API_TOKEN;
      else process.env.HOMER_API_TOKEN = originalToken;
    }
  });

  it('hides PBX internal hops and topology from tenant flow and direct raw requests', async () => {
    const packet = (id: string, srcIp: string, dstIp: string, raw: string) => ({
      id, callId: 'call@10.30.0.61', timestamp: '2026-10-21T10:00:00Z',
      timestampMs: 1000, method: 'INVITE', responseCode: null,
      cseqMethod: 'INVITE', hasSdp: false,
      srcIp, dstIp, src: `${srcIp}:5060`, dst: `${dstIp}:5070`,
      captureId: 61, raw,
    });
    const packets = [
      packet('public@10.30.0.61', '51.79.127.122', '91.99.251.61',
        'INVITE sip:x SIP/2.0\r\nVia: SIP/2.0/UDP 10.30.0.61\r\nAuthorization: Digest secret'),
      packet('internal', '10.30.0.61', '91.99.251.61', 'INVITE sip:x SIP/2.0'),
    ];
    const auth = jest.spyOn(service as any, 'event').mockResolvedValue(event);
    jest.spyOn(service as any, 'messages').mockResolvedValue(packets);
    const flow = await service.flow(event.session_uuid, 'tenant-1');
    expect(flow.messages).toHaveLength(1);
    expect(JSON.stringify(flow)).not.toContain('10.30.0.61');
    expect(flow.messages[0].raw).toContain('Authorization: [REDACTED]');
    expect(flow.messages[0].id).toMatch(/^[a-f0-9]{64}$/);
    await expect(service.raw(event.session_uuid, 'internal', 'tenant-1'))
      .rejects.toBeInstanceOf(NotFoundException);
    const selected = await service.raw(event.session_uuid, flow.messages[0].id, 'tenant-1');
    expect(selected.raw).not.toContain('10.30.0.61');
    expect(auth).toHaveBeenCalledWith(event.session_uuid, 'tenant-1');
    const superFlow = await service.flow(event.session_uuid);
    expect(superFlow.messages).toHaveLength(2);
    expect(superFlow.participants).toContain('10.30.0.61:5060');
  });

  it('reuses oversized packets but authorizes again before a raw cache hit', async () => {
    const packets = Array.from({ length: 101 }, (_, index) => ({
      id: `packet-${index}`, callId: 'a@test', timestamp: '2026-10-21T10:00:00Z',
      timestampMs: 1000 + index, method: 'INVITE', responseCode: null,
      cseqMethod: 'INVITE', hasSdp: false,
      srcIp: '51.79.127.122', dstIp: '91.99.251.61',
      src: '51.79.127.122:5060', dst: '91.99.251.61:5070',
      captureId: 61, raw: 'INVITE sip:x SIP/2.0',
    }));
    const auth = jest.spyOn(service as any, 'event').mockResolvedValue(event);
    const fetchPackets = jest.spyOn(service as any, 'messages').mockResolvedValue(packets);
    const flow = await service.flow(event.session_uuid, 'tenant-1');
    expect(flow.rawMode).toBe('on_demand');
    expect(flow.messages[0].raw).toBeNull();
    const raw = await service.raw(event.session_uuid, flow.messages[0].id, 'tenant-1');
    expect(raw.raw).toBe('INVITE sip:x SIP/2.0');
    expect(fetchPackets).toHaveBeenCalledTimes(1);
    expect(auth).toHaveBeenCalledTimes(2);
    auth.mockRejectedValueOnce(new NotFoundException('Call event not found'));
    await expect(service.raw(event.session_uuid, flow.messages[0].id, 'tenant-1'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(fetchPackets).toHaveBeenCalledTimes(1);
  });

  it('truncates oversized ladders explicitly while keeping start and end messages', async () => {
    jest.spyOn(service as any, 'event').mockResolvedValue(event);
    jest.spyOn(service as any, 'messages').mockResolvedValue(Array.from({ length: 501 }, (_, index) => ({
      id: `packet-${index}`, callId: 'a@test', timestamp: '2026-10-21T10:00:00Z',
      timestampMs: index, method: 'INVITE', responseCode: null,
      cseqMethod: null, hasSdp: false, srcIp: 'x', dstIp: 'y',
      src: 'x:1', dst: 'y:2', captureId: 61, raw: 'INVITE',
    })));
    const flow = await service.flow(event.session_uuid);
    expect(flow.traceTruncated).toBe(true);
    expect(flow.omittedMessages).toBe(1);
    expect(flow.messages).toHaveLength(500);
    expect(flow.messages[0].id).toBe('packet-0');
    expect(flow.messages[499].id).toBe('packet-500');
  });

  it('uses on-demand raw mode when one message exceeds the embedded byte threshold', async () => {
    jest.spyOn(service as any, 'event').mockResolvedValue(event);
    jest.spyOn(service as any, 'messages').mockResolvedValue([{
      id: 'large', callId: 'a@test', timestamp: '2026-10-21T10:00:00Z',
      timestampMs: 1000, method: 'INVITE', responseCode: null,
      cseqMethod: 'INVITE', hasSdp: true, srcIp: 'x', dstIp: 'y',
      src: 'x:1', dst: 'y:2', captureId: 61, raw: 'x'.repeat(256 * 1024 + 1),
    }]);
    const flow = await service.flow(event.session_uuid);
    expect(flow.rawMode).toBe('on_demand');
    expect(flow.messages[0].raw).toBeNull();
    expect(flow.messages[0].rawAvailable).toBe(true);
  });

  it('rejects an oversized Homer response before parsing it', async () => {
    const response = { headers: { get: () => String(8 * 1024 * 1024 + 1) } } as unknown as Response;
    await expect((service as any).readHomer(response)).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('coalesces simultaneous flow opens for the same call', async () => {
    jest.spyOn(service as any, 'event').mockResolvedValue(event);
    let finish: (value: any[]) => void;
    const fetchPackets = jest.spyOn(service as any, 'messages')
      .mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const first = service.flow(event.session_uuid);
    const second = service.flow(event.session_uuid);
    await Promise.resolve();
    finish!([]);
    await Promise.all([first, second]);
    expect(fetchPackets).toHaveBeenCalledTimes(1);
  });
});
