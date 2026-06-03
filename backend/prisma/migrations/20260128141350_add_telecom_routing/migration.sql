/*
  Warnings:

  - You are about to drop the column `number` on the `extensions` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `extensions` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[sipUsername]` on the table `extensions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,extensionNumber]` on the table `extensions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `extensionNumber` to the `extensions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `extensions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sipPassword` to the `extensions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sipUsername` to the `extensions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserAuditAction" ADD VALUE 'IMPERSONATE_USER';
ALTER TYPE "UserAuditAction" ADD VALUE 'END_IMPERSONATION';

-- DropIndex
DROP INDEX "extensions_tenantId_number_key";

-- AlterTable
ALTER TABLE "extensions" DROP COLUMN "number",
DROP COLUMN "userId",
ADD COLUMN     "extensionNumber" TEXT NOT NULL,
ADD COLUMN     "forwardAllDestination" TEXT,
ADD COLUMN     "forwardAllEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "forwardAllType" TEXT,
ADD COLUMN     "forwardBusyDestination" TEXT,
ADD COLUMN     "forwardBusyEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "forwardBusyType" TEXT,
ADD COLUMN     "forwardNoAnswerDestination" TEXT,
ADD COLUMN     "forwardNoAnswerEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "forwardNoAnswerTimeout" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "forwardNoAnswerType" TEXT,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "outboundCallerIdNumber" TEXT,
ADD COLUMN     "sipAuthRealm" TEXT,
ADD COLUMN     "sipPassword" TEXT NOT NULL,
ADD COLUMN     "sipUsername" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "allowCallRecording" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowDIDForwards" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowSchedules" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowVoicemail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "maxDIDs" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "maxExtensions" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "maxIVRs" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "maxRingGroups" INTEGER NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE "ring_groups" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "strategy" TEXT NOT NULL DEFAULT 'simultaneous',
    "ringTimeout" INTEGER NOT NULL DEFAULT 30,
    "noAnswerAction" TEXT,
    "noAnswerDestination" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ring_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ring_group_members" (
    "id" TEXT NOT NULL,
    "ringGroupId" TEXT NOT NULL,
    "extensionId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ring_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ivrs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "greetingAudioPath" TEXT,
    "invalidAudioPath" TEXT,
    "timeoutMs" INTEGER NOT NULL DEFAULT 5000,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "menu" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ivrs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dids" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'telnyx',
    "monthlyFee" DECIMAL(65,30) NOT NULL DEFAULT 2.00,
    "routeType" TEXT,
    "routeTargetId" TEXT,
    "forwardEnabled" BOOLEAN NOT NULL DEFAULT false,
    "forwardNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_schedules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "daysMask" INTEGER NOT NULL DEFAULT 31,
    "primaryRouteType" TEXT NOT NULL,
    "primaryRouteTarget" TEXT NOT NULL,
    "afterHoursRouteType" TEXT NOT NULL,
    "afterHoursRouteTarget" TEXT NOT NULL,
    "weekendRouteType" TEXT NOT NULL,
    "weekendRouteTarget" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operational_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_files" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "durationSeconds" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audio_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ring_groups_tenantId_idx" ON "ring_groups"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ring_group_members_ringGroupId_extensionId_key" ON "ring_group_members"("ringGroupId", "extensionId");

-- CreateIndex
CREATE INDEX "ivrs_tenantId_idx" ON "ivrs"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "dids_number_key" ON "dids"("number");

-- CreateIndex
CREATE INDEX "dids_tenantId_idx" ON "dids"("tenantId");

-- CreateIndex
CREATE INDEX "dids_number_idx" ON "dids"("number");

-- CreateIndex
CREATE INDEX "operational_schedules_tenantId_idx" ON "operational_schedules"("tenantId");

-- CreateIndex
CREATE INDEX "audio_files_tenantId_idx" ON "audio_files"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "extensions_sipUsername_key" ON "extensions"("sipUsername");

-- CreateIndex
CREATE INDEX "extensions_tenantId_idx" ON "extensions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "extensions_tenantId_extensionNumber_key" ON "extensions"("tenantId", "extensionNumber");

-- AddForeignKey
ALTER TABLE "ring_groups" ADD CONSTRAINT "ring_groups_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ring_group_members" ADD CONSTRAINT "ring_group_members_ringGroupId_fkey" FOREIGN KEY ("ringGroupId") REFERENCES "ring_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ring_group_members" ADD CONSTRAINT "ring_group_members_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "extensions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ivrs" ADD CONSTRAINT "ivrs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dids" ADD CONSTRAINT "dids_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_schedules" ADD CONSTRAINT "operational_schedules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_files" ADD CONSTRAINT "audio_files_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
