-- AlterTable: add totalFetched to ScheduledDisparoLog
ALTER TABLE "ScheduledDisparoLog" ADD COLUMN IF NOT EXISTS "totalFetched" INTEGER NOT NULL DEFAULT 0;
