-- Migration: Fix customer_rec_rc.cust_id column type to TEXT
-- Idempotent: only alters if column is not already TEXT

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'customer_rec_rc'
      AND column_name = 'cust_id'
      AND data_type != 'text'
  ) THEN
    ALTER TABLE customer_rec_rc ALTER COLUMN cust_id TYPE TEXT USING cust_id::text;
  END IF;
END $$;
