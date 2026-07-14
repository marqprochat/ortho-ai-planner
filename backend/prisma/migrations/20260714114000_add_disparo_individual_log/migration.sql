-- CreateTable
CREATE TABLE IF NOT EXISTS "DisparoIndividualLog" (
    "id" TEXT NOT NULL,
    "scheduleLogId" TEXT,
    "scheduleId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'automatic',
    "paciente" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisparoIndividualLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DisparoIndividualLog_scheduleLogId_idx" ON "DisparoIndividualLog"("scheduleLogId");
CREATE INDEX IF NOT EXISTS "DisparoIndividualLog_executedAt_idx" ON "DisparoIndividualLog"("executedAt");

-- AddForeignKey
ALTER TABLE "DisparoIndividualLog" DROP CONSTRAINT IF EXISTS "DisparoIndividualLog_scheduleLogId_fkey";
ALTER TABLE "DisparoIndividualLog" ADD CONSTRAINT "DisparoIndividualLog_scheduleLogId_fkey" FOREIGN KEY ("scheduleLogId") REFERENCES "ScheduledDisparoLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
