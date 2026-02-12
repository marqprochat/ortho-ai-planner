-- CreateTable
CREATE TABLE "Treatment" (
    "id" TEXT NOT NULL,
    "planningId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EM_ANDAMENTO',
    "startDate" TIMESTAMP(3) NOT NULL,
    "deadline" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "lastAppointment" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Treatment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Treatment_planningId_key" ON "Treatment"("planningId");

-- AddForeignKey
ALTER TABLE "Treatment" ADD CONSTRAINT "Treatment_planningId_fkey" FOREIGN KEY ("planningId") REFERENCES "Planning"("id") ON DELETE CASCADE ON UPDATE CASCADE;
