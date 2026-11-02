/*
  Warnings:

  - A unique constraint covering the columns `[importKey]` on the table `Evidence` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Evidence" ADD COLUMN     "importKey" TEXT;

-- CreateTable
CREATE TABLE "ExportCheck" (
    "id" TEXT NOT NULL,
    "cvId" TEXT NOT NULL,
    "cvRevision" INTEGER NOT NULL,
    "version" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExportCheck_cvId_cvRevision_version_key" ON "ExportCheck"("cvId", "cvRevision", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Evidence_importKey_key" ON "Evidence"("importKey");

-- AddForeignKey
ALTER TABLE "ExportCheck" ADD CONSTRAINT "ExportCheck_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "Cv"("id") ON DELETE CASCADE ON UPDATE CASCADE;
