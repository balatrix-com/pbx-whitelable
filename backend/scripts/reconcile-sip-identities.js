// Dry run by default. Run against a database backup in staging before --apply.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Client } = require('pg');
const crypto = require('crypto');

async function main() {
  const apply = process.argv.includes('--apply');
  if (apply && process.env.RECONCILE_SIP_IDENTITIES !== 'apply') {
    throw new Error('Set RECONCILE_SIP_IDENTITIES=apply to enable writes');
  }
  const prisma = new PrismaClient();
  let kamailio;
  try {
    const rows = await prisma.extension.findMany({
      select: { id: true, tenantId: true, extensionNumber: true, sipUsername: true, sipPassword: true },
    });
    const mismatches = rows.filter(row => row.sipUsername !== row.extensionNumber);
    for (const row of mismatches) {
      console.log(JSON.stringify({ id: row.id, tenantId: row.tenantId,
        currentUsername: row.sipUsername, requiredUsername: row.extensionNumber }));
    }
    console.log(`${mismatches.length} SIP username mismatches; mode=${apply ? 'apply' : 'dry-run'}`);
    if (!apply || mismatches.length === 0) return;
    if (!process.env.SIP_REALM || !process.env.FS_DB_PASSWORD) {
      throw new Error('SIP_REALM and FS_DB_PASSWORD are required for apply');
    }
    kamailio = new Client({
      host: process.env.FS_DB_HOST,
      port: Number(process.env.FS_DB_PORT || 5432),
      database: process.env.KAMAILIO_DB_NAME || 'kamailio',
      user: process.env.FS_DB_USER,
      password: process.env.FS_DB_PASSWORD,
    });
    await kamailio.connect();
    for (const row of mismatches) {
      if (!row.sipPassword) throw new Error(`Missing SIP password for extension ${row.id}`);
      const duplicate = await prisma.extension.findFirst({
        where: { sipUsername: row.extensionNumber, NOT: { id: row.id } }, select: { id: true },
      });
      if (duplicate) throw new Error(`Canonical username collision for extension ${row.id}`);
      const ha1 = crypto.createHash('md5')
        .update(`${row.extensionNumber}:${process.env.SIP_REALM}:${row.sipPassword}`).digest('hex');
      await kamailio.query(
        `INSERT INTO subscriber (username, domain, password, ha1, ha1b)
         VALUES ($1, $2, $3, $4, $4)
         ON CONFLICT (username, domain) DO UPDATE SET
           password = EXCLUDED.password, ha1 = EXCLUDED.ha1, ha1b = EXCLUDED.ha1b`,
        [row.extensionNumber, process.env.SIP_REALM, row.sipPassword, ha1]
      );
      await prisma.extension.update({ where: { id: row.id }, data: { sipUsername: row.extensionNumber } });
      if (row.sipUsername) {
        await kamailio.query('DELETE FROM subscriber WHERE username = $1 AND domain = $2',
          [row.sipUsername, process.env.SIP_REALM]);
      }
      console.log(`Reconciled extension ${row.id}`);
    }
  } finally {
    if (kamailio) await kamailio.end();
    await prisma.$disconnect();
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
