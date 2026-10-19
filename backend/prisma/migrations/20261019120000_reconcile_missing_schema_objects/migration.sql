-- ============================================================================
-- 20261019120000_reconcile_missing_schema_objects
-- Ensures customer_ratecard, subscription_addons_catalog, partner SMTP fields,
-- and rate card per-second rates exist across all reseller servers.
-- Fully idempotent with IF NOT EXISTS checks.
-- ============================================================================

-- 1. Create Missing Table: subscription_addons_catalog
CREATE TABLE IF NOT EXISTS "subscription_addons_catalog" (
    "id" TEXT NOT NULL,
    "addon_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "units_count" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_addons_catalog_pkey" PRIMARY KEY ("id")
);

-- Unique index for addon_id
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_addons_catalog_addon_id_key" ON "subscription_addons_catalog"("addon_id");

-- 2. Create Missing Table: customer_ratecard
CREATE TABLE IF NOT EXISTS "customer_ratecard" (
    "customer_id" TEXT NOT NULL,
    "ratecard_id" INTEGER NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_ratecard_pkey" PRIMARY KEY ("customer_id")
);

-- Add Foreign Key for customer_ratecard if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name='customer_ratecard_ratecard_id_fkey' AND table_name='customer_ratecard'
    ) THEN
        ALTER TABLE "customer_ratecard" 
        ADD CONSTRAINT "customer_ratecard_ratecard_id_fkey" 
        FOREIGN KEY ("ratecard_id") REFERENCES "rate_cards"("ratecard_id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 3. Add Missing SMTP Fields to "partners"
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "smtpFromEmail" TEXT;
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "smtpFromName" TEXT;
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "smtpHost" TEXT;
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "smtpPass" TEXT;
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "smtpPort" INTEGER;
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "smtpSecure" BOOLEAN DEFAULT false;
ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "smtpUser" TEXT;

-- 4. Add Missing per-second Rate Fields to "rate_cards"
ALTER TABLE "rate_cards" ADD COLUMN IF NOT EXISTS "in_rate_per_sec" DECIMAL(65,30);
ALTER TABLE "rate_cards" ADD COLUMN IF NOT EXISTS "ob_rate_per_sec" DECIMAL(65,30);

-- 5. Add Missing Status to "tenants"
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';
