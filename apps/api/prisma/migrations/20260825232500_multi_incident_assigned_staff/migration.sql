-- DropForeignKey
ALTER TABLE "Incident" DROP CONSTRAINT IF EXISTS "Incident_assignedStaffId_fkey";

-- AlterTable
ALTER TABLE "Incident" DROP COLUMN IF EXISTS "assignedStaffId";

-- CreateTable
CREATE TABLE "_StaffAssignedIncidents" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_StaffAssignedIncidents_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_StaffAssignedIncidents_B_index" ON "_StaffAssignedIncidents"("B");

-- AddForeignKey
ALTER TABLE "_StaffAssignedIncidents" ADD CONSTRAINT "_StaffAssignedIncidents_A_fkey" FOREIGN KEY ("A") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StaffAssignedIncidents" ADD CONSTRAINT "_StaffAssignedIncidents_B_fkey" FOREIGN KEY ("B") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
