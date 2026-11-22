-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "passwordHash" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "participantIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
