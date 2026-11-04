-- AlterTable
ALTER TABLE "tenant_features" ADD COLUMN IF NOT EXISTS "monitorLimit" INTEGER NOT NULL DEFAULT 10;
