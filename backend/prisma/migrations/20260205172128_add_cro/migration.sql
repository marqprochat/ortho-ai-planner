-- DropForeignKey
ALTER TABLE "Planning" DROP CONSTRAINT "Planning_patientId_fkey";

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "insurance" TEXT,
ADD COLUMN     "patientNumber" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cro" TEXT;

-- AlterTable
ALTER TABLE "_PermissionToRole" ADD CONSTRAINT "_PermissionToRole_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_PermissionToRole_AB_unique";

-- CreateTable
CREATE TABLE "AiApiKey" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiApiKey_provider_key" ON "AiApiKey"("provider");

-- AddForeignKey
ALTER TABLE "Planning" ADD CONSTRAINT "Planning_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
