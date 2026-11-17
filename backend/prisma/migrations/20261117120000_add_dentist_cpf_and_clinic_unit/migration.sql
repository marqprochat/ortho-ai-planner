-- AlterTable
ALTER TABLE "Clinic" ADD COLUMN "easyDentalUnitName" TEXT;

-- AlterTable
ALTER TABLE "Dentist" ADD COLUMN "cpf" TEXT;

-- CreateIndex
CREATE INDEX "Dentist_cpf_idx" ON "Dentist"("cpf");
