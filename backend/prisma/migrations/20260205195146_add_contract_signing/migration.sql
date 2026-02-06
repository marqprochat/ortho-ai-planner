-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "isSigned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "signedAt" TIMESTAMP(3);
