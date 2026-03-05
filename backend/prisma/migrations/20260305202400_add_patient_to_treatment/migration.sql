-- AlterTable
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "complement" TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "cro" TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "district" TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "number" TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "street" TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "zipCode" TEXT;

-- AlterTable
ALTER TABLE "Treatment" ADD COLUMN IF NOT EXISTS "nextAppointment" TIMESTAMP(3);
ALTER TABLE "Treatment" ADD COLUMN IF NOT EXISTS "patientId" TEXT;
ALTER TABLE "Treatment" ALTER COLUMN "planningId" DROP NOT NULL;
ALTER TABLE "Treatment" ALTER COLUMN "startDate" SET DEFAULT CURRENT_TIMESTAMP;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Treatment_patientId_fkey') THEN
        ALTER TABLE "Treatment" ADD CONSTRAINT "Treatment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Populate patientId for existing treatments
UPDATE "Treatment"
SET "patientId" = "Planning"."patientId"
FROM "Planning"
WHERE "Treatment"."planningId" = "Planning"."id"
AND "Treatment"."patientId" IS NULL;
