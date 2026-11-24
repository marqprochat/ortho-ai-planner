-- Integração Waha: configuração, canal de envio por agendamento, texto do modelo e canal nos logs
CREATE TABLE IF NOT EXISTS "WahaConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "baseUrl" TEXT NOT NULL DEFAULT '',
    "apiKey" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WahaConfig_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ScheduledDisparo" ADD COLUMN IF NOT EXISTS "canal" TEXT NOT NULL DEFAULT 'botconversa';
ALTER TABLE "ScheduledDisparo" ADD COLUMN IF NOT EXISTS "wahaSession" TEXT;

ALTER TABLE "MessageTemplate" ADD COLUMN IF NOT EXISTS "wahaText" TEXT NOT NULL DEFAULT '';

ALTER TABLE "DisparoIndividualLog" ADD COLUMN IF NOT EXISTS "canal" TEXT NOT NULL DEFAULT 'botconversa';
ALTER TABLE "DisparoIndividualLog" ADD COLUMN IF NOT EXISTS "wahaSession" TEXT;
