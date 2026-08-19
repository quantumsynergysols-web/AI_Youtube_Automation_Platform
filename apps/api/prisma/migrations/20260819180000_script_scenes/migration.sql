-- CreateEnum
CREATE TYPE "SceneRole" AS ENUM ('HOOK', 'INTRODUCTION', 'BODY', 'CALL_TO_ACTION');

-- AlterTable
ALTER TABLE "Scene" ADD COLUMN     "narration" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "role" "SceneRole" NOT NULL DEFAULT 'BODY';

