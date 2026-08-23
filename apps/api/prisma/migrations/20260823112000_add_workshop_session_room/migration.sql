-- AlterTable
ALTER TABLE "WorkshopSession" ADD COLUMN "location" TEXT,
ADD COLUMN "roomId" TEXT;

-- AddForeignKey
ALTER TABLE "WorkshopSession" ADD CONSTRAINT "WorkshopSession_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
