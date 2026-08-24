-- CreateTable
CREATE TABLE "WorkshopFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkshopFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopFavorite_userId_workshopId_key" ON "WorkshopFavorite"("userId", "workshopId");

-- AddForeignKey
ALTER TABLE "WorkshopFavorite" ADD CONSTRAINT "WorkshopFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopFavorite" ADD CONSTRAINT "WorkshopFavorite_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
