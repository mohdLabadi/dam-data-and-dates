ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "chatId" uuid;
ALTER TABLE "Document" ADD CONSTRAINT "Document_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE set null ON UPDATE no action;
