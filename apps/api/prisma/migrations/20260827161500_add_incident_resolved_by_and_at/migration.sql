-- AlterTable
ALTER TABLE "Incident" ADD COLUMN "resolvedById" TEXT,
ADD COLUMN "resolvedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
