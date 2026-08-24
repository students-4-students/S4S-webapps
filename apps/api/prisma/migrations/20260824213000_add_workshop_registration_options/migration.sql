-- AlterTable
ALTER TABLE "Workshop" ADD COLUMN "onlyOneSlotPerUser" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isRegistrationClosed" BOOLEAN NOT NULL DEFAULT false;
