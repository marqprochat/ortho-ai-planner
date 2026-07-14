-- AlterTable
ALTER TABLE "ScheduledDisparo" ADD COLUMN "searchMode" TEXT NOT NULL DEFAULT 'agendamento';

-- AlterTable
ALTER TABLE "MessageTemplate" ADD COLUMN "searchMode" TEXT NOT NULL DEFAULT 'agendamento';
