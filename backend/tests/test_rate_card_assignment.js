/**
 * Test Suite: Rate Card Auto-Assignment & Recording Toggle Guard (PBX Whitelabel)
 * ===============================================================================
 * Run: node test_rate_card_assignment.js
 *
 * Prerequisites:
 *   - PBX Whitelabel backend running on http://localhost:3000
 *   - Sub-billing service running
 *   - PostgreSQL accessible (uses DATABASE_URL from .env)
 *   - A Super Admin JWT token set as SUPER_ADMIN_TOKEN env var
 *
 * Usage:
 *   SUPER_ADMIN_TOKEN=<jwt> node test_rate_card_assignment.js
 *   or add to .env:  SUPER_ADMIN_TOKEN=<jwt>
 */

const http = require('http');
const https = require('https');
const { Client } = require('pg');
require('dotenv').config();

// ─── CONFIG ────────────────────────────────────────────────────────────────
const CONFIG = {
  pbxBaseUrl:      process.env.PBX_API_URL      || 'http://localhost:3000/api',
  superAdminToken: process.env.SUPER_ADMIN_TOKEN || '',          // <<< mandatory
  testPlanId:      process.env.TEST_PLAN_ID      || 'test_rate_card_plan', // sub-billing plan_id
  expectedRcId:    Number(process.env.EXPECTED_RC_ID  || 1),    // plan's rate_card_id
  validRecRcId:    Number(process.env.VALID_REC_RC_ID || 1),    // valid recording rc id
  invalidRecRcId:  Number(process.env.INVALID_REC_RC_ID || 9999),
  dbUrl:           process.env.DATABASE_URL,
};
// ───────────────────────────────────────────────────────────────────────────

// ── tiny HTTP helper ────────────────────────────────────────────────────────
function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url  = new URL(CONFIG.pbxBaseUrl + path);
    const lib  = url.protocol === 'https:' ? https : http;
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      method,
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${CONFIG.superAdminToken}`,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = lib.request(opts, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ── DB helper ───────────────────────────────────────────────────────────────
async function dbQuery(sql, params = []) {
  const client = new Client({ connectionString: CONFIG.dbUrl });
  await client.connect();
  try   { return (await client.query(sql, params)).rows; }
  finally { await client.end(); }
}

// ── test runner ─────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const results = [];

async function test(name, fn) {
  process.stdout.write(`  ▸ ${name} ... `);
  try {
    await fn();
    console.log('\x1b[32m✓ PASS\x1b[0m');
    passed++;
    results.push({ name, status: 'PASS' });
  } catch (e) {
    console.log(`\x1b[31m✗ FAIL\x1b[0m → ${e.message}`);
    failed++;
    results.push({ name, status: 'FAIL', error: e.message });
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

// ── unique test data ────────────────────────────────────────────────────────
const SUFFIX     = Date.now().toString().slice(-6);
const TEST_EMAIL = `testrc_${SUFFIX}@balatrix-test.internal`;

let createdTenantId    = null;
let createdCustomerCode = null;

// ════════════════════════════════════════════════════════════════════════════
//  GROUP 1 — Rate Card Auto-Assignment on Tenant Creation
// ════════════════════════════════════════════════════════════════════════════
async function group1() {
  console.log('\n\x1b[34m══ Group 1: Rate Card Auto-Assignment on Tenant Creation ══\x1b[0m');

  await test('TC-1.1: Create tenant with plan → succeeds (2xx)', async () => {
    const res = await apiRequest('POST', '/admin/tenants', {
      customerType:  'individual',
      firstName:     'TestRateCard',
      lastName:      `User${SUFFIX}`,
      adminEmail:    TEST_EMAIL,
      adminPassword: 'Test@123456',
      phone:         '+1 555 000 0001',
      address:       '123 Test Avenue Suite 1',
      city:          'TestCity',
      state:         'CA',
      country:       'USA',
      planId:        CONFIG.testPlanId,
    });
    assert(
      res.status === 201 || res.status === 200,
      `Expected 2xx, got ${res.status}: ${JSON.stringify(res.body)}`,
    );
    createdTenantId     = res.body?.data?.tenant?.id    || res.body?.tenant?.id;
    createdCustomerCode = res.body?.data?.tenant?.customerCode || res.body?.tenant?.customerCode;
    assert(createdTenantId,     'Response must include tenant.id');
    assert(createdCustomerCode, 'Response must include tenant.customerCode');
  });

  await test('TC-1.2: customer_ratecard row exists for new customer', async () => {
    assert(createdCustomerCode, 'Requires TC-1.1');
    const rows = await dbQuery(
      'SELECT ratecard_id FROM customer_ratecard WHERE customer_id = $1',
      [createdCustomerCode],
    );
    assert(rows.length > 0, `No customer_ratecard row for customer ${createdCustomerCode}`);
  });

  await test(`TC-1.3: rate card is correct (expect ratecard_id=${CONFIG.expectedRcId})`, async () => {
    assert(createdCustomerCode, 'Requires TC-1.1');
    const rows = await dbQuery(
      'SELECT ratecard_id FROM customer_ratecard WHERE customer_id = $1',
      [createdCustomerCode],
    );
    assert(rows.length > 0, 'No rate card row found');
    const actual = Number(rows[0].ratecard_id);
    assert(
      actual === CONFIG.expectedRcId,
      `BUG: Expected ratecard_id=${CONFIG.expectedRcId}, got ${actual} (plan rate card NOT applied!)`,
    );
  });

  await test('TC-1.4: Local subscription record is ACTIVE', async () => {
    assert(createdTenantId, 'Requires TC-1.1');
    const rows = await dbQuery(
      "SELECT id, status FROM subscriptions WHERE tenant_id = $1 AND status = 'ACTIVE'",
      [createdTenantId],
    );
    assert(rows.length > 0, `No ACTIVE subscription for tenant ${createdTenantId}`);
  });

  await test('TC-1.5: Create tenant WITHOUT planId still succeeds', async () => {
    const noplanEmail = `noplan_${SUFFIX}@balatrix-test.internal`;
    const res = await apiRequest('POST', '/admin/tenants', {
      customerType:  'individual',
      firstName:     'NoPlan',
      lastName:      `User${SUFFIX}`,
      adminEmail:    noplanEmail,
      adminPassword: 'Test@123456',
      phone:         '+1 555 000 0002',
      address:       '456 NoPlan Street Suite 2',
      city:          'TestCity',
      state:         'CA',
      country:       'USA',
    });
    assert(
      res.status === 201 || res.status === 200,
      `Expected 2xx, got ${res.status}: ${JSON.stringify(res.body)}`,
    );
  });
}

// ════════════════════════════════════════════════════════════════════════════
//  GROUP 2 — Call Recording Toggle Guard
// ════════════════════════════════════════════════════════════════════════════
async function group2() {
  console.log('\n\x1b[34m══ Group 2: Call Recording Toggle Requires Rate Card ══\x1b[0m');

  await test('TC-2.1: Enable recording WITHOUT recRateCardId → 400', async () => {
    assert(createdTenantId, 'Requires Group 1 tenant');
    const res = await apiRequest('PATCH', `/admin/tenants/${createdTenantId}/features`, {
      recordingAllowed: true,
    });
    assert(res.status === 400, `Expected 400, got ${res.status}. Body: ${JSON.stringify(res.body)}`);
    const msg = (res.body?.message || '').toLowerCase();
    assert(msg.includes('rate card') || msg.includes('ratecard'),
      `Error message must mention rate card; got: "${res.body?.message}"`);
  });

  await test('TC-2.2: Enable recording with non-existent recRateCardId → 400', async () => {
    assert(createdTenantId, 'Requires Group 1 tenant');
    const res = await apiRequest('PATCH', `/admin/tenants/${createdTenantId}/features`, {
      recordingAllowed: true,
      recRateCardId:    CONFIG.invalidRecRcId,
    });
    assert(res.status === 400, `Expected 400, got ${res.status}. Body: ${JSON.stringify(res.body)}`);
  });

  await test('TC-2.3: Enable recording with valid recRateCardId → 200', async () => {
    assert(createdTenantId, 'Requires Group 1 tenant');
    const res = await apiRequest('PATCH', `/admin/tenants/${createdTenantId}/features`, {
      recordingAllowed: true,
      recRateCardId:    CONFIG.validRecRcId,
    });
    assert(res.status === 200, `Expected 200, got ${res.status}. Body: ${JSON.stringify(res.body)}`);
  });

  await test('TC-2.4: customer_rec_rc mapping exists in DB after enabling recording', async () => {
    assert(createdCustomerCode, 'Requires Group 1 tenant');
    const rows = await dbQuery(
      'SELECT rec_rc_id FROM customer_rec_rc WHERE cust_id = $1',
      [createdCustomerCode],
    );
    assert(rows.length > 0, `No customer_rec_rc row for ${createdCustomerCode}`);
    assert(
      Number(rows[0].rec_rc_id) === CONFIG.validRecRcId,
      `Expected rec_rc_id=${CONFIG.validRecRcId}, got ${rows[0].rec_rc_id}`,
    );
  });

  await test('TC-2.5: Disable recording without recRateCardId → 200 (no RC needed)', async () => {
    assert(createdTenantId, 'Requires Group 1 tenant');
    const res = await apiRequest('PATCH', `/admin/tenants/${createdTenantId}/features`, {
      recordingAllowed: false,
    });
    assert(res.status === 200, `Expected 200, got ${res.status}. Body: ${JSON.stringify(res.body)}`);
  });
}

// ════════════════════════════════════════════════════════════════════════════
//  GROUP 3 — Regression / Edge Cases
// ════════════════════════════════════════════════════════════════════════════
async function group3() {
  console.log('\n\x1b[34m══ Group 3: Regression & Edge Cases ══\x1b[0m');

  await test('TC-3.1: Create tenant with non-existent planId still creates tenant (non-fatal)', async () => {
    const email2 = `badplan_${SUFFIX}@balatrix-test.internal`;
    const res = await apiRequest('POST', '/admin/tenants', {
      customerType:  'individual',
      firstName:     'BadPlan',
      lastName:      `User${SUFFIX}`,
      adminEmail:    email2,
      adminPassword: 'Test@123456',
      phone:         '+1 555 000 0003',
      address:       '789 BadPlan Road Suite 3',
      city:          'TestCity',
      state:         'CA',
      country:       'USA',
      planId:        'non_existent_plan_xyz_99999',
    });
    assert(
      res.status === 201 || res.status === 200,
      `Expected 2xx, got ${res.status}: ${JSON.stringify(res.body)}`,
    );
  });

  await test('TC-3.2: Re-enabling recording with same rate card is idempotent', async () => {
    assert(createdTenantId, 'Requires Group 1 tenant');
    const res = await apiRequest('PATCH', `/admin/tenants/${createdTenantId}/features`, {
      recordingAllowed: true,
      recRateCardId:    CONFIG.validRecRcId,
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const rows = await dbQuery(
      'SELECT rec_rc_id FROM customer_rec_rc WHERE cust_id = $1',
      [createdCustomerCode],
    );
    assert(rows.length > 0, 'customer_rec_rc row missing after idempotent re-enable');
  });
}

// ════════════════════════════════════════════════════════════════════════════
//  CLEANUP
// ════════════════════════════════════════════════════════════════════════════
async function cleanup() {
  if (!createdTenantId) return;
  console.log(`\n\x1b[33m  ↩ Cleaning up test tenant ${createdTenantId} ...\x1b[0m`);
  try {
    const res = await apiRequest('DELETE', `/admin/tenants/${createdTenantId}`);
    console.log(res.status < 300 ? '  ✓ Test tenant deleted' : `  ⚠ Delete returned ${res.status} — clean up manually`);
  } catch (e) {
    console.log(`  ⚠ Cleanup failed: ${e.message}`);
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  MAIN
// ════════════════════════════════════════════════════════════════════════════
(async () => {
  console.log('\n\x1b[1m╔══════════════════════════════════════════════════════════╗');
  console.log('║  Rate Card Assignment & Recording Toggle Test Suite      ║');
  console.log('╚══════════════════════════════════════════════════════════╝\x1b[0m');
  console.log(`  PBX API  : ${CONFIG.pbxBaseUrl}`);
  console.log(`  Test Plan: ${CONFIG.testPlanId} (expect rate_card_id=${CONFIG.expectedRcId})`);

  if (!CONFIG.superAdminToken) {
    console.error('\n\x1b[31m  ERROR: SUPER_ADMIN_TOKEN is not set.\x1b[0m\n  Set it as env var or in .env file.\n');
    process.exit(1);
  }
  if (!CONFIG.dbUrl) {
    console.error('\n\x1b[31m  ERROR: DATABASE_URL is not set.\x1b[0m\n');
    process.exit(1);
  }

  try {
    await group1();
    await group2();
    await group3();
  } finally {
    await cleanup();
  }

  console.log('\n\x1b[1m──────────────────────────────────────────────────────────\x1b[0m');
  console.log(`  Results: \x1b[32m${passed} passed\x1b[0m, \x1b[31m${failed} failed\x1b[0m  (total ${passed + failed})`);
  console.log('──────────────────────────────────────────────────────────\n');

  if (failed > 0) {
    console.log('\x1b[31m  Failed tests:\x1b[0m');
    results.filter(r => r.status === 'FAIL').forEach(r =>
      console.log(`    ✗ ${r.name}\n      → ${r.error}`));
    process.exit(1);
  }
})();
