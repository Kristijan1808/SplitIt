ALTER TABLE "people" ADD COLUMN "userId" TEXT;

CREATE UNIQUE INDEX "people_groupId_userId_key" ON "people"("groupId", "userId");

ALTER TABLE "people"
ADD CONSTRAINT "people_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
