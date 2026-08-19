-- AlterEnum
ALTER TYPE "JobStage" ADD VALUE 'IMPORT';

-- CreateTable
CREATE TABLE "ChannelVideo" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "youtubeVideoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "durationSec" INTEGER,
    "viewCount" INTEGER,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChannelVideo_channelId_publishedAt_idx" ON "ChannelVideo"("channelId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelVideo_channelId_youtubeVideoId_key" ON "ChannelVideo"("channelId", "youtubeVideoId");

-- AddForeignKey
ALTER TABLE "ChannelVideo" ADD CONSTRAINT "ChannelVideo_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

