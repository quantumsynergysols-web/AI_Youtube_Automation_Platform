-- AlterTable
ALTER TABLE "Channel" DROP COLUMN "disconnectedAt",
ADD COLUMN     "baselineAt" TIMESTAMP(3),
ADD COLUMN     "grantedScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "lastRefreshedAt" TIMESTAMP(3),
ADD COLUMN     "subscriberCount" INTEGER,
ADD COLUMN     "thumbnailUrl" TEXT,
ADD COLUMN     "tokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "videoCount" INTEGER;

