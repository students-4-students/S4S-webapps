-- AlterTable
ALTER TABLE "ScheduleSlot" ADD COLUMN     "rcId" TEXT;

-- AddForeignKey
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_rcId_fkey" FOREIGN KEY ("rcId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
