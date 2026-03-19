import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { auth } from "@/app/(auth)/auth";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import { DEFAULT_CHAT_MODEL, resolveChatModelId } from "@/lib/ai/models";
import { getChatById, getMessagesByChatId } from "@/lib/db/queries";
import { convertToUIMessages } from "@/lib/utils";

export default function Page(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="flex h-dvh" />}>
      <ChatPage params={props.params} />
    </Suspense>
  );
}

const hasDatabase = Boolean(process.env.POSTGRES_URL);

async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();

  if (!session) {
    redirect("/api/auth/guest");
  }

  const chat = hasDatabase ? await getChatById({ id }) : null;

  if (hasDatabase && !chat) {
    redirect("/");
  }

  if (chat?.visibility === "private") {
    if (!session.user) {
      return notFound();
    }

    if (session.user.id !== chat.userId) {
      return notFound();
    }
  }

  const messagesFromDb = hasDatabase
    ? await getMessagesByChatId({ id })
    : [];

  const uiMessages = convertToUIMessages(messagesFromDb);

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get("chat-model");

  if (!chatModelFromCookie) {
    return (
      <>
        <Chat
          autoResume={true}
          id={id}
          initialChatModel={DEFAULT_CHAT_MODEL}
          initialMessages={uiMessages}
          initialVisibilityType={chat?.visibility ?? "private"}
          isReadonly={chat ? session?.user?.id !== chat.userId : false}
        />
        <DataStreamHandler />
      </>
    );
  }

  return (
    <>
      <Chat
        autoResume={true}
        id={id}
        initialChatModel={resolveChatModelId(chatModelFromCookie.value)}
        initialMessages={uiMessages}
        initialVisibilityType={chat?.visibility ?? "private"}
        isReadonly={chat ? session?.user?.id !== chat.userId : false}
      />
      <DataStreamHandler />
    </>
  );
}
