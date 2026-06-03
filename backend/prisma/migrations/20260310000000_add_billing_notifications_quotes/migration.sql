-- Migration: add_billing_notifications_quotes
-- Adds all tables and columns introduced after 20260218141455_add_monitoring_permission

-- AlterTable: Add new columns to users (if not already present)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "monitoringExtension" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "monitoringSecret" TEXT;

-- CreateTable: idempotency_keys
CREATE TABLE IF NOT EXISTS "idempotency_keys" (
    "key" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "response" JSONB NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("key")
);

-- CreateTable: pricing_blueprints
CREATE TABLE IF NOT EXISTS "pricing_blueprints" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "components" JSONB NOT NULL,
    "rules" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_blueprints_pkey" PRIMARY KEY ("id")
);

-- CreateEnum (safe - check if not exists)
DO $$ BEGIN
    CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'EXPIRED', 'CONVERTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable: quotes
CREATE TABLE IF NOT EXISTS "quotes" (
    "id" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerCompany" TEXT,
    "planId" TEXT,
    "blueprintId" TEXT,
    "customPrice" DECIMAL(65,30),
    "telecomDetails" JSONB NOT NULL,
    "pricingSnapshot" JSONB,
    "assetSnapshot" JSONB,
    "dealValue" DECIMAL(65,30),
    "commission" DECIMAL(65,30),
    "commissionRate" DECIMAL(65,30),
    "salesRepId" TEXT,
    "stripeCustomerId" TEXT,
    "tenantId" TEXT,
    "token" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex on quotes.token
CREATE UNIQUE INDEX IF NOT EXISTS "quotes_token_key" ON "quotes"("token");

-- AddForeignKey: quotes -> plans
ALTER TABLE "quotes" DROP CONSTRAINT IF EXISTS "quotes_planId_fkey";
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: quotes -> pricing_blueprints
ALTER TABLE "quotes" DROP CONSTRAINT IF EXISTS "quotes_blueprintId_fkey";
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "pricing_blueprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: quotes -> tenants
ALTER TABLE "quotes" DROP CONSTRAINT IF EXISTS "quotes_tenantId_fkey";
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum (safe)
DO $$ BEGIN
    CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PENDING', 'PAID', 'VOID', 'REFUNDED', 'DISPUTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable: invoices
CREATE TABLE IF NOT EXISTS "invoices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "total" DECIMAL(65,30) NOT NULL,
    "balanceDue" DECIMAL(65,30) NOT NULL,
    "stripeId" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "quoteId" TEXT,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndexes on invoices
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_stripeId_key" ON "invoices"("stripeId");
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_idempotencyKey_key" ON "invoices"("idempotencyKey");

-- AddForeignKey: invoices -> quotes
ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_quoteId_fkey";
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: invoice_adjustments
CREATE TABLE IF NOT EXISTS "invoice_adjustments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "authorizedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_adjustments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: invoice_adjustments -> invoices
ALTER TABLE "invoice_adjustments" DROP CONSTRAINT IF EXISTS "invoice_adjustments_invoiceId_fkey";
ALTER TABLE "invoice_adjustments" ADD CONSTRAINT "invoice_adjustments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: tenant_config_versions
CREATE TABLE IF NOT EXISTS "tenant_config_versions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "configSnapshot" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "serviceOrderId" TEXT,

    CONSTRAINT "tenant_config_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: notifications
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex on notifications
CREATE INDEX IF NOT EXISTS "notifications_tenantId_idx" ON "notifications"("tenantId");
CREATE INDEX IF NOT EXISTS "notifications_userId_idx" ON "notifications"("userId");

-- AddForeignKey: notifications -> tenants
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_tenantId_fkey";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: notifications -> users
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_userId_fkey";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
