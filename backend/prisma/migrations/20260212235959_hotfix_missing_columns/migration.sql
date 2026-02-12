-- AlterTable
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "patientNumber" TEXT;

-- AlterTable (ensure User.cro exist too)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cro" TEXT;
