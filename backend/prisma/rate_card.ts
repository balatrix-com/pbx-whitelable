import { Client } from 'pg';

interface RateCardSeedData {
  name: string;
  currency: string;
  in_rate_per_min: number;
  in_initial_increment_sec: number;
  in_increment_sec: number;
  ob_rate_per_min: number;
  ob_initial_increment_sec: number;
  ob_increment_sec: number;
}

interface RecRateCardSeedData {
  id?: number;
  name: string;
  currency: string;
  rate_per_min: number;
  retention_period: 7 | 15 | 30;
}

export async function seedRateCards() {
  console.log('--- Starting Rate Cards Seeding ---');

  // 1. Standard Rate Cards Data
  const standardCards: RateCardSeedData[] = [
    {
      name: 'Standard_Global',
      currency: 'USD',
      in_rate_per_min: 0.0020,
      in_initial_increment_sec: 60,
      in_increment_sec: 60,
      ob_rate_per_min: 0.0080,
      ob_initial_increment_sec: 60,
      ob_increment_sec: 60,
    },
    {
      name: 'Premium_US_CA',
      currency: 'USD',
      in_rate_per_min: 0.0015,
      in_initial_increment_sec: 60,
      in_increment_sec: 60,
      ob_rate_per_min: 0.0050,
      ob_initial_increment_sec: 60,
      ob_increment_sec: 60,
    }
  ];

  // 2. Recording Rate Cards Data (Restricted to 7, 15, 30 days)
  const recordingCards: RecRateCardSeedData[] = [
    {
      id: 1,
      name: '7_Days_Standard',
      currency: 'USD',
      rate_per_min: 0.0020,
      retention_period: 7,
    },
    {
      id: 2,
      name: '15_Days_Standard',
      currency: 'USD',
      rate_per_min: 0.0050,
      retention_period: 15,
    },
    {
      id: 3,
      name: '30_Days_Standard',
      currency: 'USD',
      rate_per_min: 0.0080,
      retention_period: 30,
    }
  ];

  const dbHost = process.env.DB_HOST || '10.30.0.61';
  const dbPort = parseInt(process.env.PORT || '5432', 10);
  const dbUser = process.env.DB_USER || 'subadmin';
  const dbPassword = process.env.DB_PASSWORD || 'OnidaMaruti1)';
  const dbName = process.env.DB_NAME || 'subtest';

  const client = new Client({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
  });

  try {
    await client.connect();
    console.log(`Connected directly to Sub-Billing Database (${dbName} on ${dbHost})`);

    // Ensure tables exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS rate_cards (
          ratecard_id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          currency CHAR(3) NOT NULL DEFAULT 'USD',
          country TEXT,
          in_rate_per_min NUMERIC(14,6) NOT NULL DEFAULT 0,
          in_initial_increment_sec INTEGER NOT NULL DEFAULT 60,
          in_increment_sec INTEGER NOT NULL DEFAULT 60,
          ob_rate_per_min NUMERIC(14,6) NOT NULL DEFAULT 0,
          ob_initial_increment_sec INTEGER NOT NULL DEFAULT 60,
          ob_increment_sec INTEGER NOT NULL DEFAULT 60,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS rec_rate_card (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          currency CHAR(3) NOT NULL DEFAULT 'USD',
          rate_per_min NUMERIC(14,6) NOT NULL DEFAULT 0,
          retention_period INTEGER NOT NULL DEFAULT 7,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS customer_rec_rc (
          cust_id TEXT PRIMARY KEY,
          rec_rc_id INTEGER NOT NULL REFERENCES rec_rate_card(id) ON DELETE CASCADE,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Seed Standard Rate Cards
    for (const card of standardCards) {
      await client.query(`
        INSERT INTO rate_cards (name, currency, in_rate_per_min, in_initial_increment_sec, in_increment_sec, ob_rate_per_min, ob_initial_increment_sec, ob_increment_sec)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT DO NOTHING;
      `, [card.name, card.currency, card.in_rate_per_min, card.in_initial_increment_sec, card.in_increment_sec, card.ob_rate_per_min, card.ob_initial_increment_sec, card.ob_increment_sec]);
      console.log(`✓ Seeded Standard Rate Card: ${card.name}`);
    }

    // Seed Recording Rate Cards (7, 15, 30 Days)
    for (const recCard of recordingCards) {
      await client.query(`
        INSERT INTO rec_rate_card (id, name, currency, rate_per_min, retention_period)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name,
            retention_period = EXCLUDED.retention_period,
            rate_per_min = EXCLUDED.rate_per_min;
      `, [recCard.id, recCard.name, recCard.currency, recCard.rate_per_min, recCard.retention_period]);
      console.log(`✓ Seeded Recording Rate Card: ${recCard.name} (${recCard.retention_period} Days)`);
    }

    // Adjust ID sequence
    await client.query(`SELECT setval(pg_get_serial_sequence('rec_rate_card', 'id'), COALESCE((SELECT MAX(id) FROM rec_rate_card), 1));`);

    console.log('--- Rate Cards Seeding Completed Successfully ---');
  } catch (err: any) {
    console.error(`Database Seeding error: ${err.message}`);
  } finally {
    await client.end().catch(() => {});
  }
}

if (require.main === module) {
  seedRateCards()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Rate Card Seeding Failed:', err);
      process.exit(1);
    });
}
