/*
  Warnings:

  - You are about to drop the column `insurance` on the `Patient` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Patient" DROP COLUMN "insurance",
ADD COLUMN     "paymentType" TEXT;
