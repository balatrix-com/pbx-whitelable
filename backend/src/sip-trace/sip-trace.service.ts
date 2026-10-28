import {
  BadGatewayException, BadRequestException, Injectable, Logger, NotFoundException,
  OnModuleDestroy, ServiceUnavailableException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { PrismaService } from '../prisma/prisma.service';

type TraceRow = {
  session_uuid: string; customer_id: string | null; direction: string | null;
  caller_number: string | null; destination_number: string | null;
  started_at: Date | null; ended_at: Date | null; first_leg_received_at: Date;
  a_leg_sip_call_id: string | null; b_leg_sip_call_ids: string[];
  merge_status: string; cdr_export_status: string; hangup_cause: string | null;
};
type Json = Record<string, any>;
type SipMessage = {
  id: string; callId: string; timestamp: string | null; timestampMs: number;
  method: string; responseCode: number | null; cseqMethod: string | null;
  hasSdp: boolean; src: string; dst: string; srcIp: string; dstIp: string;
  captureId: number; raw: string; rawFingerprint: string;
};

const EMBEDDED_MESSAGE_LIMIT = 100;
const EMBEDDED_RAW_BYTES = 256 * 1024;
const FLOW_MESSAGE_LIMIT = 500;
const HOMER_RESPONSE_BYTES = 8 * 1024 * 1024;
const HOMER_PACKET_LIMIT = 2000;
const CACHE_ENTRY_LIMIT = 5;
const CACHE_ENTRY_BYTES = 10 * 1024 * 1024;
const CACHE_TOTAL_BYTES = 32 * 1024 * 1024;
const CACHE_TTL_MS = 120_000;

@Injectable()
export class SipTraceService implements OnModuleDestroy {
  private readonly logger = new Logger(SipTraceService.name);
  private pool?: Pool;
  private readonly oversizedCache = new Map<string, { messages: SipMessage[]; bytes: number; expires: number }>();
  private readonly inFlight = new Map<string, Promise<SipMessage[]>>();
  private cachedBytes = 0;
  private readonly hiddenIps = new Set((process.env.SIP_TRACE_TENANT_HIDDEN_IPS || '10.30.0.61')
    .split(',').map(value => value.trim().toLowerCase()).filter(value => isIP(value) !== 0));
  private readonly hiddenAddresses = [...this.hiddenIps,
    ...(process.env.SIP_TRACE_TENANT_HIDDEN_HOSTS || '').split(',').map(value => value.trim()).filter(Boolean)];

  constructor(private readonly prisma: PrismaService) {}

  async onModuleDestroy() {
    this.oversizedCache.clear();
    this.inFlight.clear();
    this.cachedBytes = 0;
    await this.pool?.end();
  }

  private db() {
    if (!process.env.SIP_TRACE_DATABASE_URL) {
      throw new ServiceUnavailableException('SIP trace database is not configured');
    }
    this.pool ??= new Pool({ connectionString: process.env.SIP_TRACE_DATABASE_URL, max: 4,
      connectionTimeoutMillis: 3000, idleTimeoutMillis: 30000, statement_timeout: 5000 });
    return this.pool;
  }

  private date(value: string | undefined, fallback: number) {
    if (!value) return new Date(fallback);
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) throw new BadRequestException('Invalid date');
    return date;
  }

  async list(query: Record<string, string>) {
    const to = this.date(query.to, Date.now());
    const from = this.date(query.from, to.getTime() - 24 * 3600_000);
    if (from >= to || to.getTime() - from.getTime() > 31 * 86400_000) {
      throw new BadRequestException('Choose a time window of at most 31 days');
    }
    const requestedLimit = query.limit === undefined ? 25 : Number(query.limit);
    const requestedPage = query.page === undefined ? 1 : Number(query.page);
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 100 ||
        !Number.isInteger(requestedPage) || requestedPage < 1 || requestedPage > 1000) {
      throw new BadRequestException('Invalid pagination');
    }
    const limit = requestedLimit;
    const page = requestedPage;
    const customer = (query.customerId || '').trim();
    const search = (query.search || '').trim();
    if (customer.length > 80 || search.length > 120) throw new BadRequestException('Search is too long');
    const values = [from, to, customer, search, limit + 1, (page - 1) * limit];
    const rows = await this.db().query<TraceRow>(`
      SELECT session_uuid, customer_id, direction, caller_number, destination_number,
             started_at, ended_at, first_leg_received_at, a_leg_sip_call_id,
             b_leg_sip_call_ids, merge_status, cdr_export_status, hangup_cause
      FROM live_call_event
      WHERE COALESCE(started_at, first_leg_received_at) >= $1
        AND COALESCE(started_at, first_leg_received_at) < $2
        AND ($3 = '' OR customer_id = $3)
        AND ($4 = '' OR session_uuid ILIKE '%' || $4 || '%'
             OR caller_number ILIKE '%' || $4 || '%'
             OR destination_number ILIKE '%' || $4 || '%'
             OR a_leg_sip_call_id ILIKE '%' || $4 || '%'
             OR $4 = ANY(b_leg_sip_call_ids))
      ORDER BY COALESCE(started_at, first_leg_received_at) DESC, id DESC
      LIMIT $5 OFFSET $6`, values);
    return { data: rows.rows.slice(0, limit).map(row => this.summary(row)),
      page, hasMore: rows.rows.length > limit };
  }

  private async tenantCustomerCode(tenantId: string) {
    if (!tenantId) throw new NotFoundException('Tenant not found');
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId }, select: { customerCode: true },
    });
    if (!tenant?.customerCode) throw new NotFoundException('Tenant trace identity not configured');
    return tenant.customerCode;
  }

  async tenantList(tenantId: string, query: Record<string, string>) {
    const customerCode = await this.tenantCustomerCode(tenantId);
    const page = query.page === undefined ? 1 : Number(query.page);
    const limit = query.limit === undefined ? 25 : Number(query.limit);
    if (!Number.isInteger(page) || page < 1 || page > 4 ||
        !Number.isInteger(limit) || limit < 1 || limit > 100 ||
        (page - 1) * limit >= 100) throw new BadRequestException('Invalid tenant trace page');
    const search = (query.search || '').trim();
    if (search.length > 120) throw new BadRequestException('Search is too long');
    // Rank first, filter second: search/time filters must never expose call 101+.
    const rows = await this.db().query<TraceRow>(`
      WITH latest AS (
        SELECT session_uuid, customer_id, direction, caller_number, destination_number,
               started_at, ended_at, first_leg_received_at, a_leg_sip_call_id,
               b_leg_sip_call_ids, merge_status, cdr_export_status, hangup_cause, id
        FROM live_call_event
        WHERE customer_id = $1 AND a_leg_uuid IS NOT NULL
          AND COALESCE(NULLIF(a_leg_json->'variables'->>'billing_customer_id', ''),
                       a_leg_json->'variables'->>'variable_billing_customer_id') = $1
        ORDER BY COALESCE(started_at, first_leg_received_at) DESC, id DESC
        LIMIT 100
      )
      SELECT session_uuid, customer_id, direction, caller_number, destination_number,
             started_at, ended_at, first_leg_received_at, a_leg_sip_call_id,
             b_leg_sip_call_ids, merge_status, cdr_export_status, hangup_cause
      FROM latest
      WHERE ($2 = '' OR session_uuid ILIKE '%' || $2 || '%'
             OR caller_number ILIKE '%' || $2 || '%'
             OR destination_number ILIKE '%' || $2 || '%'
             OR a_leg_sip_call_id ILIKE '%' || $2 || '%'
             OR $2 = ANY(b_leg_sip_call_ids))
      ORDER BY COALESCE(started_at, first_leg_received_at) DESC, id DESC
      LIMIT $3 OFFSET $4`, [customerCode, search,
        Math.min(limit + 1, 101 - (page - 1) * limit), (page - 1) * limit]);
    return { data: rows.rows.slice(0, limit).map(row => this.summary(row, true)),
      page, hasMore: rows.rows.length > limit, maxVisibleCalls: 100 };
  }

  private summary(row: TraceRow, tenant = false) {
    const { a_leg_sip_call_id, b_leg_sip_call_ids, ...rest } = row;
    return tenant
      ? { ...rest, traceAvailable: this.callIds(row).length > 0 }
      : { ...rest, sipCallIds: this.callIds(row), traceAvailable: this.callIds(row).length > 0 };
  }

  private callIds(row: TraceRow) {
    return [...new Set([row.a_leg_sip_call_id, ...(row.b_leg_sip_call_ids || [])]
      .filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 255
        && !/[\x00-\x1f\x7f]/.test(id)))].slice(0, 50);
  }

  private async event(sessionUuid: string, tenantId?: string) {
    if (!/^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(sessionUuid)) {
      throw new BadRequestException('Invalid session UUID');
    }
    const customerCode = tenantId ? await this.tenantCustomerCode(tenantId) : null;
    const result = await this.db().query<TraceRow>(customerCode ? `
      WITH latest AS (
        SELECT session_uuid FROM live_call_event
        WHERE customer_id = $2 AND a_leg_uuid IS NOT NULL
          AND COALESCE(NULLIF(a_leg_json->'variables'->>'billing_customer_id', ''),
                       a_leg_json->'variables'->>'variable_billing_customer_id') = $2
        ORDER BY COALESCE(started_at, first_leg_received_at) DESC, id DESC
        LIMIT 100
      )
      SELECT event.session_uuid, event.customer_id, event.direction,
             event.caller_number, event.destination_number, event.started_at,
             event.ended_at, event.first_leg_received_at, event.a_leg_sip_call_id,
             event.b_leg_sip_call_ids, event.merge_status, event.cdr_export_status,
             event.hangup_cause
      FROM live_call_event AS event JOIN latest USING (session_uuid)
      WHERE event.session_uuid = $1 AND event.customer_id = $2 LIMIT 1` : `
      SELECT session_uuid, customer_id, direction, caller_number, destination_number,
             started_at, ended_at, first_leg_received_at, a_leg_sip_call_id,
             b_leg_sip_call_ids, merge_status, cdr_export_status, hangup_cause
      FROM live_call_event WHERE session_uuid = $1 LIMIT 1`,
      customerCode ? [sessionUuid, customerCode] : [sessionUuid]);
    if (!result.rows[0]) throw new NotFoundException('Call event not found');
    return result.rows[0];
  }

  private window(row: TraceRow) {
    const start = (row.started_at || row.first_leg_received_at).getTime();
    const end = row.ended_at?.getTime()
      || Math.min(Math.ceil(Date.now() / 60000) * 60000, start + 24 * 3600_000);
    return { from: start - 300000, to: end + 300000 };
  }

  private cacheKey(row: TraceRow) {
    return createHash('sha256').update(JSON.stringify([
      row.session_uuid, this.callIds(row), this.window(row),
    ])).digest('hex');
  }

  private cacheGet(key: string) {
    const entry = this.oversizedCache.get(key);
    if (!entry) return undefined;
    this.oversizedCache.delete(key);
    this.cachedBytes -= entry.bytes;
    if (entry.expires <= Date.now()) return undefined;
    this.oversizedCache.set(key, entry);
    this.cachedBytes += entry.bytes;
    this.logger.debug('SIP trace oversized-cache hit');
    return entry.messages;
  }

  private cachePut(key: string, messages: SipMessage[]) {
    const bytes = Buffer.byteLength(JSON.stringify(messages), 'utf8');
    if (bytes > CACHE_ENTRY_BYTES) return;
    const existing = this.oversizedCache.get(key);
    if (existing) {
      this.cachedBytes -= existing.bytes;
      this.oversizedCache.delete(key);
    }
    for (const [entryKey, entry] of this.oversizedCache) {
      if (entry.expires <= Date.now()) {
        this.cachedBytes -= entry.bytes;
        this.oversizedCache.delete(entryKey);
      }
    }
    while (this.oversizedCache.size >= CACHE_ENTRY_LIMIT ||
           this.cachedBytes + bytes > CACHE_TOTAL_BYTES) {
      const oldest = this.oversizedCache.keys().next().value;
      if (!oldest) break;
      this.cachedBytes -= this.oversizedCache.get(oldest)!.bytes;
      this.oversizedCache.delete(oldest);
    }
    this.oversizedCache.set(key, { messages, bytes, expires: Date.now() + CACHE_TTL_MS });
    this.cachedBytes += bytes;
    this.logger.debug(`SIP trace oversized-cache store bytes=${bytes} entries=${this.oversizedCache.size} totalBytes=${this.cachedBytes}`);
  }

  private async packets(row: TraceRow) {
    const key = this.cacheKey(row);
    const cached = this.cacheGet(key);
    if (cached) return cached;
    const pending = this.inFlight.get(key);
    if (pending) return pending;
    const task = this.messages(row);
    this.inFlight.set(key, task);
    try { return await task; }
    finally { if (this.inFlight.get(key) === task) this.inFlight.delete(key); }
  }

  private async readHomer(response: Response): Promise<{ payload: Json; bytes: number }> {
    const headerLength = Number(response.headers?.get('content-length') || 0);
    if (headerLength > HOMER_RESPONSE_BYTES) {
      throw new BadGatewayException('Homer trace exceeds portal response limit');
    }
    let body: string;
    if (response.body) {
      const reader = response.body.getReader();
      const chunks: Buffer[] = [];
      let bytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > HOMER_RESPONSE_BYTES) {
          await reader.cancel();
          throw new BadGatewayException('Homer trace exceeds portal response limit');
        }
        chunks.push(Buffer.from(value));
      }
      body = Buffer.concat(chunks, bytes).toString('utf8');
    } else {
      body = await response.text();
      if (Buffer.byteLength(body, 'utf8') > HOMER_RESPONSE_BYTES) {
        throw new BadGatewayException('Homer trace exceeds portal response limit');
      }
    }
    try { return { payload: JSON.parse(body) as Json, bytes: Buffer.byteLength(body, 'utf8') }; }
    catch { throw new BadGatewayException('Homer returned invalid JSON'); }
  }

  private async messages(row: TraceRow): Promise<SipMessage[]> {
    const started = Date.now();
    const ids = this.callIds(row);
    if (!ids.length) return [];
    const base = process.env.HOMER_API_BASE_URL?.replace(/\/$/, '');
    const token = process.env.HOMER_API_TOKEN?.trim();
    if (!base || !token) throw new ServiceUnavailableException('Homer API is not configured');
    // Every query is constrained by server-owned Call-IDs and the call's time window.
    const body = { ...(ids.length === 1 ? { session_id: ids[0] } : { session_ids: ids }),
      proto_type: 1, event_type: 'call',
      timestamp: this.window(row) };
    let response: Response;
    try {
      response = await fetch(`${base}/api/v4/transactions/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Auth-Token': token },
        body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
      });
    } catch { throw new BadGatewayException('Homer is unavailable'); }
    if (!response.ok) throw new BadGatewayException(`Homer returned HTTP ${response.status}`);
    const { payload, bytes } = await this.readHomer(response);
    const data = payload?.data;
    const rows: Json[] = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
    if (rows.length > HOMER_PACKET_LIMIT) {
      throw new BadGatewayException('Homer trace contains too many packets for portal');
    }
    const allowed = new Set(ids);
    const mapped = rows.map((item, index) => {
      const protocol = item.protocol_header || {};
      const detail = item.data_header || {};
      const callId = String(detail.call_id || item.sid || item.session_id || item.call_id || '');
      if (!allowed.has(callId)) return null;
      const originalRaw = String(item.raw || item.payload || '');
      const raw = this.redact(originalRaw);
      const dateValue = item.timestamp || item.create_date;
      const epoch = Number(dateValue || item.micro_ts || 0);
      const parsed = typeof dateValue === 'string' ? Date.parse(dateValue) : NaN;
      const timestampMs = Number(protocol.time_seconds) > 0
        ? Number(protocol.time_seconds) * 1000 + Number(protocol.time_useconds || 0) / 1000
        : Number.isFinite(parsed) ? parsed
          : epoch > 1e15 ? epoch / 1000 : epoch > 1e12 ? epoch : epoch * 1000;
      const method = String(detail.method || item.method || raw.split(/\r?\n/, 1)[0] || 'SIP');
      const responseCode = /^[1-6]\d\d$/.test(method) ? Number(method) : null;
      const cseqMethod = raw.match(/^CSeq:\s*\d+\s+([A-Z]+)\b/im)?.[1] || null;
      const hasSdp = /^Content-Type:\s*application\/sdp\b/im.test(raw);
      const srcIp = String(protocol.src_ip || item.src_ip || '?');
      const dstIp = String(protocol.dst_ip || item.dst_ip || '?');
      return { id: String(item.id || item.uuid || `${callId}-${timestampMs}-${index}`), callId,
        timestamp: Number.isFinite(timestampMs) && timestampMs > 0 ? new Date(timestampMs).toISOString() : null,
        timestampMs, method, responseCode, cseqMethod, hasSdp,
        src: `${srcIp}:${protocol.src_port || item.src_port || '?'}`,
        dst: `${dstIp}:${protocol.dst_port || item.dst_port || '?'}`,
        srcIp, dstIp, captureId: Number(protocol.capture_id ?? item.capture_id ?? 0), raw,
        rawFingerprint: createHash('sha256').update(originalRaw).digest('hex') };
    }).filter((item): item is SipMessage => item !== null)
      .sort((a, b) => a.timestampMs - b.timestampMs);
    // Homer may contain mirrored duplicate HEP packets. Keep the first copy
    // and its ID so raw-message retrieval can still find the same packet.
    const seen = new Set<string>();
    const deduplicated = mapped.filter(item => {
      const fingerprint = JSON.stringify([item.callId, item.timestampMs, item.src, item.dst, item.rawFingerprint]);
      if (seen.has(fingerprint)) return false;
      seen.add(fingerprint);
      return true;
    });
    this.logger.debug(`SIP trace Homer fetch ms=${Date.now() - started} bytes=${bytes} packets=${rows.length} mapped=${deduplicated.length}`);
    return deduplicated;
  }

  private isHiddenIp(value: string) {
    const normalized = value.toLowerCase().replace(/^::ffff:/, '');
    return this.hiddenIps.has(normalized);
  }

  private maskTenant(value: string) {
    let result = value;
    for (const address of this.hiddenAddresses) {
      let index = result.toLowerCase().indexOf(address.toLowerCase());
      while (index >= 0) {
        result = result.slice(0, index) + '[PBX internal]' + result.slice(index + address.length);
        index = result.toLowerCase().indexOf(address.toLowerCase(), index + '[PBX internal]'.length);
      }
    }
    return result;
  }

  private visiblePackets(row: TraceRow, packets: SipMessage[], tenant: boolean) {
    if (!tenant) return packets;
    return packets.filter(packet => !this.isHiddenIp(packet.srcIp) && !this.isHiddenIp(packet.dstIp))
      .map(packet => ({
        ...packet,
        id: createHash('sha256').update(JSON.stringify([
          row.session_uuid, packet.id, packet.timestampMs, packet.src, packet.dst, packet.raw,
        ])).digest('hex'),
        callId: this.maskTenant(packet.callId),
        method: this.maskTenant(packet.method),
        src: this.maskTenant(packet.src),
        dst: this.maskTenant(packet.dst),
        raw: this.maskTenant(packet.raw),
      }));
  }

  private displayed(packets: SipMessage[]) {
    if (packets.length <= FLOW_MESSAGE_LIMIT) return packets;
    const half = FLOW_MESSAGE_LIMIT / 2;
    return [...packets.slice(0, half), ...packets.slice(-half)];
  }

  async flow(sessionUuid: string, tenantId?: string) {
    const row = await this.event(sessionUuid, tenantId);
    const packets = await this.packets(row);
    const visible = this.visiblePackets(row, packets, Boolean(tenantId));
    const embeddedBytes = visible.reduce((sum, packet) => sum + Buffer.byteLength(packet.raw, 'utf8'), 0);
    const embedded = visible.length <= EMBEDDED_MESSAGE_LIMIT && embeddedBytes <= EMBEDDED_RAW_BYTES;
    if (!embedded) this.cachePut(this.cacheKey(row), packets);
    const messages = this.displayed(visible);
    const participants = [...new Set(messages.flatMap(message => [message.src, message.dst]))];
    const first = messages[0]?.timestampMs || 0;
    return { call: this.summary(row, Boolean(tenantId)), participants,
      rawMode: embedded ? 'embedded' : 'on_demand',
      noExternalSignaling: Boolean(tenantId) && packets.length > 0 && visible.length === 0,
      traceTruncated: visible.length > messages.length,
      omittedMessages: visible.length - messages.length,
      messages: messages.map(message => ({
        id: message.id, callId: message.callId, timestamp: message.timestamp,
        timestampMs: message.timestampMs, method: message.method,
        responseCode: message.responseCode, cseqMethod: message.cseqMethod,
        hasSdp: message.hasSdp, src: message.src, dst: message.dst,
        captureId: message.captureId,
        elapsedMs: message.timestampMs - first,
        fromIndex: participants.indexOf(message.src), toIndex: participants.indexOf(message.dst),
        raw: embedded ? this.redact(message.raw) : null,
        rawAvailable: Boolean(message.raw) })) };
  }

  async raw(sessionUuid: string, messageId: string, tenantId?: string) {
    if (!messageId || messageId.length > 512) throw new BadRequestException('Invalid message ID');
    const row = await this.event(sessionUuid, tenantId);
    const key = this.cacheKey(row);
    const cacheEntry = this.oversizedCache.get(key);
    const cacheHit = Boolean(cacheEntry && cacheEntry.expires > Date.now());
    const packets = await this.packets(row);
    const visible = this.visiblePackets(row, packets, Boolean(tenantId));
    const message = this.displayed(visible).find(item => item.id === messageId);
    if (!message) throw new NotFoundException('SIP message not found in this call');
    if (!cacheHit && (visible.length > EMBEDDED_MESSAGE_LIMIT ||
        visible.reduce((sum, packet) => sum + Buffer.byteLength(packet.raw, 'utf8'), 0) > EMBEDDED_RAW_BYTES)) {
      this.cachePut(key, packets);
    }
    return { id: message.id, raw: this.redact(message.raw) };
  }

  private redact(raw: string) {
    return raw.replace(/^(Authorization|Proxy-Authorization|WWW-Authenticate|Proxy-Authenticate|P-Asserted-Identity|Remote-Party-ID):[^\r\n]*(?:\r?\n[ \t]+[^\r\n]*)*/gim,
      (_full, header) => `${header}: [REDACTED]`);
  }
}
