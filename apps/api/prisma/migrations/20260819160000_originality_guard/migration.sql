-- AlterTable
ALTER TABLE "OriginalityCheck" ADD COLUMN     "hasCommentary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hookEdited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiresDisclosure" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "similarity" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Script" ADD COLUMN     "commentary" TEXT,
ADD COLUMN     "commentaryAddedAt" TIMESTAMP(3),
ADD COLUMN     "hookEditedAt" TIMESTAMP(3),
ADD COLUMN     "humanInputMs" INTEGER NOT NULL DEFAULT 0;

