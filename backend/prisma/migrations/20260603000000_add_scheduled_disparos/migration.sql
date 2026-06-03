-- CreateTable
CREATE TABLE "ScheduledDisparo" (
    "id"                TEXT NOT NULL,
    "name"              TEXT NOT NULL,
    "description"       TEXT,
    "cronExpression"    TEXT NOT NULL,
    "isActive"          BOOLEAN NOT NULL DEFAULT true,
    "unidades"          TEXT[] DEFAULT ARRAY[]::TEXT[],
    "agendas"           TEXT[] DEFAULT ARRAY[]::TEXT[],
    "statusAgendamento" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "periodos"          TEXT[] DEFAULT ARRAY[]::TEXT[],
    "motivo"            TEXT NOT NULL DEFAULT '',
    "dtInicioOffset"    INTEGER NOT NULL DEFAULT 1,
    "dtTerminoOffset"   INTEGER NOT NULL DEFAULT 1,
    "modelo"            TEXT NOT NULL DEFAULT '22180',
    "delayMs"           INTEGER NOT NULL DEFAULT 1000,
    "concurrentLimit"   INTEGER NOT NULL DEFAULT 5,
    "createdBy"         TEXT NOT NULL,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledDisparo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledDisparoLog" (
    "id"             TEXT NOT NULL,
    "scheduleId"     TEXT NOT NULL,
    "executedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status"         TEXT NOT NULL,
    "totalSent"      INTEGER NOT NULL DEFAULT 0,
    "totalErrors"    INTEGER NOT NULL DEFAULT 0,
    "totalProcessed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage"   TEXT,
    "dtInicio"       TEXT NOT NULL,
    "dtTermino"      TEXT NOT NULL,

    CONSTRAINT "ScheduledDisparoLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ScheduledDisparoLog" ADD CONSTRAINT "ScheduledDisparoLog_scheduleId_fkey"
    FOREIGN KEY ("scheduleId") REFERENCES "ScheduledDisparo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
