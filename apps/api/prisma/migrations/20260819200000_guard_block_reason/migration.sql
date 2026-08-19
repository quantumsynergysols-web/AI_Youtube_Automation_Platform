-- CreateEnum
CREATE TYPE "GuardBlockReason" AS ENUM ('SIMILARITY', 'COMMENTARY', 'HOOK');

-- AlterTable
ALTER TABLE "OriginalityCheck" ADD COLUMN     "blockedOn" "GuardBlockReason";

