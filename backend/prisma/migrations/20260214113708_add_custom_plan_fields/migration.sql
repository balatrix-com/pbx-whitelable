/*
  Warnings:

  - You are about to drop the column `resource` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `tenantId` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `audit_logs` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[customerCode]` on the table `tenants` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `audio_files` table without a default value. This is not possible if the table is not empty.
  - Added the required column `actorType` to the `audit_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `category` to the `audit_logs` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'EXPIRED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PENDING', 'PAID', 'VOID', 'REFUNDED', 'DISPUTED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SALES';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TFNStatus" ADD VALUE 'HELD';
ALTER TYPE "TFNStatus" ADD VALUE 'QUARANTINE';

-- AlterTable
ALTER TABLE "audio_files" ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "audit_logs" DROP COLUMN "resource",
DROP COLUMN "tenantId",
DROP COLUMN "userId",
ADD COLUMN     "actorEmail" TEXT,
ADD COLUMN     "actorId" TEXT,
ADD COLUMN     "actorType" TEXT NOT NULL,
ADD COLUMN     "category" TEXT NOT NULL,
ADD COLUMN     "targetId" TEXT,
ADD COLUMN     "targetType" TEXT;

-- AlterTable
ALTER TABLE "dids" ADD COLUMN     "sequenceId" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "extensions" ADD COLUMN     "password" TEXT,
ADD COLUMN     "sequenceId" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ivrs" ADD COLUMN     "sequenceId" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "operational_schedules" ADD COLUMN     "sequenceId" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "initialCredit" DECIMAL(65,30) NOT NULL DEFAULT 0.00,
ADD COLUMN     "isCustom" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxDIDForwards" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "ring_groups" ADD COLUMN     "sequenceId" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "customerCode" TEXT;

-- AlterTable
ALTER TABLE "tfns" ADD COLUMN     "forwardEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "forwardNumber" TEXT,
ADD COLUMN     "heldBy" TEXT,
ADD COLUMN     "heldUntil" TIMESTAMP(3),
ADD COLUMN     "routeTargetId" TEXT,
ADD COLUMN     "routeType" TEXT;

-- CreateTable
CREATE TABLE "did_forwards" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sequenceId" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "destinationNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "did_forwards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
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
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "key" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "response" JSONB NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "pricing_blueprints" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "components" JSONB NOT NULL,
    "rules" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_blueprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
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

-- CreateTable
CREATE TABLE "invoice_adjustments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "authorizedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_config_versions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "configSnapshot" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "serviceOrderId" TEXT,

    CONSTRAINT "tenant_config_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "did_forwards_tenantId_idx" ON "did_forwards"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_token_key" ON "quotes"("token");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_stripeId_key" ON "invoices"("stripeId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_idempotencyKey_key" ON "invoices"("idempotencyKey");

-- CreateIndex
CREATE INDEX "audit_logs_category_idx" ON "audit_logs"("category");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_customerCode_key" ON "tenants"("customerCode");

-- CreateIndex
CREATE INDEX "tfns_status_routeType_idx" ON "tfns"("status", "routeType");

-- AddForeignKey
ALTER TABLE "did_forwards" ADD CONSTRAINT "did_forwards_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "pricing_blueprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_adjustments" ADD CONSTRAINT "invoice_adjustments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
