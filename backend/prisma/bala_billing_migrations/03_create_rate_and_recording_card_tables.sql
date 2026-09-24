-- =============================================
-- 03: Rate Card & Recording Rate Card Tables + Seeds
-- =============================================

-- NOTE: rate_cards and customer_ratecard are now created in 01_create_tables.sql
-- This file only creates recording rate card tables and seeds them.

-- 1. Recording Rate Card
CREATE TABLE rec_rate_card (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    rate_per_min NUMERIC(14,6) NOT NULL DEFAULT 0,
    retention_period INTEGER NOT NULL DEFAULT 7,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Customer Recording Rate Card Mapping
CREATE TABLE customer_rec_rc (
    cust_id TEXT PRIMARY KEY,
    rec_rc_id INTEGER NOT NULL REFERENCES rec_rate_card(id) ON DELETE CASCADE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Seed Default Recording Rate Cards (7, 15, 30 days)
INSERT INTO rec_rate_card (id, name, currency, rate_per_min, retention_period)
VALUES 
    (1, '7_Days_Standard', 'USD', 0.0020, 7),
    (2, '15_Days_Standard', 'USD', 0.0050, 15),
    (3, '30_Days_Standard', 'USD', 0.0080, 30)
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name,
    retention_period = EXCLUDED.retention_period;

-- Adjust sequence
SELECT setval(pg_get_serial_sequence('rec_rate_card', 'id'), COALESCE((SELECT MAX(id) FROM rec_rate_card), 1));
