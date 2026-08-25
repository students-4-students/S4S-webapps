-- Update any existing OPEN status to IN_PROGRESS
UPDATE "Incident" SET status = 'IN_PROGRESS' WHERE status = 'OPEN';

-- AlterEnum
ALTER TABLE "Incident" ALTER COLUMN "status" SET DEFAULT 'IN_PROGRESS';
