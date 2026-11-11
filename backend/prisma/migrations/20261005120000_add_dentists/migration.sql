-- CreateTable
CREATE TABLE "Dentist" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "easyDentalId" TEXT,
    "name" TEXT NOT NULL,
    "cro" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dentist_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Planning" ADD COLUMN "dentistId" TEXT;
ALTER TABLE "Treatment" ADD COLUMN "dentistId" TEXT;
ALTER TABLE "Treatment" ADD COLUMN "dentistCro" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Dentist_clinicId_cro_key" ON "Dentist"("clinicId", "cro");

-- AddForeignKey
ALTER TABLE "Dentist" ADD CONSTRAINT "Dentist_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Planning" ADD CONSTRAINT "Planning_dentistId_fkey" FOREIGN KEY ("dentistId") REFERENCES "Dentist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Treatment" ADD CONSTRAINT "Treatment_dentistId_fkey" FOREIGN KEY ("dentistId") REFERENCES "Dentist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
