-- Criação das tabelas ScheduledDisparo e ScheduledDisparoLog
-- Execute este script no banco PostgreSQL de produção

CREATE TABLE IF NOT EXISTS "ScheduledDisparo" (
    "id"                TEXT        NOT NULL,
    "name"              TEXT        NOT NULL,
    "description"       TEXT,
    "cronExpression"    TEXT        NOT NULL,
    "isActive"          BOOLEAN     NOT NULL DEFAULT true,
    "unidades"          TEXT[]      NOT NULL DEFAULT '{}',
    "agendas"           TEXT[]      NOT NULL DEFAULT '{}',
    "statusAgendamento" TEXT[]      NOT NULL DEFAULT '{}',
    "periodos"          TEXT[]      NOT NULL DEFAULT '{}',
    "motivo"            TEXT        NOT NULL DEFAULT '',
    "dtInicioOffset"    INTEGER     NOT NULL DEFAULT 1,
    "dtTerminoOffset"   INTEGER     NOT NULL DEFAULT 1,
    "modelo"            TEXT        NOT NULL DEFAULT '22180',
    "delayMs"           INTEGER     NOT NULL DEFAULT 1000,
    "concurrentLimit"   INTEGER     NOT NULL DEFAULT 5,
    "createdBy"         TEXT        NOT NULL,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledDisparo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ScheduledDisparoLog" (
    "id"             TEXT         NOT NULL,
    "scheduleId"     TEXT         NOT NULL,
    "executedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status"         TEXT         NOT NULL,
    "totalSent"      INTEGER      NOT NULL DEFAULT 0,
    "totalErrors"    INTEGER      NOT NULL DEFAULT 0,
    "totalProcessed" INTEGER      NOT NULL DEFAULT 0,
    "errorMessage"   TEXT,
    "dtInicio"       TEXT         NOT NULL,
    "dtTermino"      TEXT         NOT NULL,

    CONSTRAINT "ScheduledDisparoLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ScheduledDisparoLog"
    DROP CONSTRAINT IF EXISTS "ScheduledDisparoLog_scheduleId_fkey";

ALTER TABLE "ScheduledDisparoLog"
    ADD CONSTRAINT "ScheduledDisparoLog_scheduleId_fkey"
    FOREIGN KEY ("scheduleId")
    REFERENCES "ScheduledDisparo"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- Aplicação Dental Connect
INSERT INTO "Application" ("id", "name", "displayName", "description", "icon", "url", "createdAt", "updatedAt")
VALUES (
    gen_random_uuid()::text,
    'disparos',
    'Dental Connect',
    'Comunicação inteligente com pacientes via WhatsApp',
    'DentalConnect',
    'http://localhost:5176',
    NOW(),
    NOW()
)
ON CONFLICT ("name") DO UPDATE
    SET "displayName" = 'Dental Connect',
        "description" = 'Comunicação inteligente com pacientes via WhatsApp',
        "updatedAt"   = NOW();

-- Role OPERADOR_DISPAROS
INSERT INTO "Role" ("id", "name", "description")
VALUES (gen_random_uuid()::text, 'OPERADOR_DISPAROS', 'Operador do Dental Connect')
ON CONFLICT ("name") DO NOTHING;

-- Permissão access:disparos vinculada ao app Dental Connect
INSERT INTO "Permission" ("id", "action", "resource", "description", "applicationId", "createdAt", "updatedAt")
VALUES (
    gen_random_uuid()::text,
    'access',
    'disparos',
    'Acessar o Dental Connect',
    (SELECT "id" FROM "Application" WHERE "name" = 'disparos'),
    NOW(),
    NOW()
)
ON CONFLICT ("action", "resource") DO UPDATE
    SET "applicationId" = (SELECT "id" FROM "Application" WHERE "name" = 'disparos'),
        "updatedAt"     = NOW();

-- Vincula permissão ao role OPERADOR_DISPAROS
INSERT INTO "_PermissionToRole" ("A", "B")
SELECT p."id", r."id"
FROM "Permission" p, "Role" r
WHERE p."action" = 'access' AND p."resource" = 'disparos'
  AND r."name" = 'OPERADOR_DISPAROS'
ON CONFLICT DO NOTHING;

-- Vincula permissão ao role ADMIN (se ainda não tiver)
INSERT INTO "_PermissionToRole" ("A", "B")
SELECT p."id", r."id"
FROM "Permission" p, "Role" r
WHERE p."action" = 'access' AND p."resource" = 'disparos'
  AND r."name" = 'ADMIN'
ON CONFLICT DO NOTHING;

-- Garante acesso do SuperAdmin ao app disparos com role ADMIN
INSERT INTO "UserAppAccess" ("id", "userId", "applicationId", "roleId", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    u."id",
    a."id",
    r."id",
    NOW(),
    NOW()
FROM "User" u, "Application" a, "Role" r
WHERE u."isSuperAdmin" = true
  AND a."name" = 'disparos'
  AND r."name" = 'ADMIN'
ON CONFLICT ("userId", "applicationId") DO UPDATE
    SET "roleId"    = (SELECT "id" FROM "Role" WHERE "name" = 'ADMIN'),
        "updatedAt" = NOW();
