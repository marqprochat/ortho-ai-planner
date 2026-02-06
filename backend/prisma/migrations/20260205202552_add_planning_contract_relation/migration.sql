-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "planningId" TEXT;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_planningId_fkey" FOREIGN KEY ("planningId") REFERENCES "Planning"("id") ON DELETE SET NULL ON UPDATE CASCADE;
