-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "insuranceCompany" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "canTransferPatient" BOOLEAN NOT NULL DEFAULT false;
