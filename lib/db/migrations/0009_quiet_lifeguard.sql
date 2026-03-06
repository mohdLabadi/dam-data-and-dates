CREATE TABLE IF NOT EXISTS "SavedMatch" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "createdAt" timestamp NOT NULL,
  "userId" uuid NOT NULL,
  "documentId" uuid NOT NULL,
  "profileId" text NOT NULL,
  "profile" json NOT NULL,
  CONSTRAINT "SavedMatch_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action
);

CREATE UNIQUE INDEX IF NOT EXISTS "SavedMatch_user_document_profile_unique"
  ON "SavedMatch" USING btree ("userId", "documentId", "profileId");
