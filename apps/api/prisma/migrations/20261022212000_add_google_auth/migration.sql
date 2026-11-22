ALTER TABLE "users" ADD COLUMN "googleSubject" TEXT;

CREATE UNIQUE INDEX "users_googleSubject_key" ON "users"("googleSubject");
