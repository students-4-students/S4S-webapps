-- AlterTable
ALTER TABLE "ScheduleSlot" ADD COLUMN     "assistantId" TEXT,
ADD COLUMN     "speakerId" TEXT;

-- AlterTable
ALTER TABLE "StaffMember" ADD COLUMN     "score" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_speakerId_fkey" FOREIGN KEY ("speakerId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_assistantId_fkey" FOREIGN KEY ("assistantId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
