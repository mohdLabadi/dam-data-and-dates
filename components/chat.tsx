"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { ChatHeader } from "@/components/chat-header";
import { useArtifact, useArtifactSelector } from "@/hooks/use-artifact";
import { useAutoResume } from "@/hooks/use-auto-resume";
import { INTAKE_MESSAGE_PREFIX } from "@/lib/constants";
import type { Vote } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import type { Attachment, ChatMessage } from "@/lib/types";
import { fetcher, fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
import { Artifact } from "./artifact";
import { useDataStream } from "./data-stream-provider";
import { IntakeForm } from "./intake-form";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { toast } from "./toast";
import type { VisibilityType } from "./visibility-selector";

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  autoResume,
  initialProfileDocumentId,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  autoResume: boolean;
  initialProfileDocumentId?: string | null;
}) {
  const router = useRouter();
  const visibilityType: VisibilityType = "private";
  const forceGenerateProfilesRef = useRef(false);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      // When user navigates back/forward, refresh to sync with URL
      router.refresh();
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [router]);
  const { setDataStream } = useDataStream();

  const [input, setInput] = useState<string>("");
  const [hasCompletedIntake, setHasCompletedIntake] = useState(
    initialMessages.length > 0,
  );

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
    addToolApprovalResponse,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    generateId: generateUUID,
    sendAutomaticallyWhen: ({ messages: currentMessages }) => {
      const lastMessage = currentMessages.at(-1);
      const shouldContinue =
        lastMessage?.parts?.some(
          (part) =>
            "state" in part &&
            part.state === "approval-responded" &&
            "approval" in part &&
            (part.approval as { approved?: boolean })?.approved === true,
        ) ?? false;
      return shouldContinue;
    },
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest(request) {
        const lastMessage = request.messages.at(-1);
        const isToolApprovalContinuation =
          lastMessage?.role !== "user" ||
          request.messages.some((msg) =>
            msg.parts?.some((part) => {
              const state = (part as { state?: string }).state;
              return (
                state === "approval-responded" || state === "output-denied"
              );
            }),
          );

        return {
          body: {
            id: request.id,
            message: lastMessage,
            messages: request.messages,
            selectedChatModel: initialChatModel,
            selectedVisibilityType: visibilityType,
            forceGenerateProfiles: (() => {
              const shouldForce = forceGenerateProfilesRef.current;
              forceGenerateProfilesRef.current = false;
              return shouldForce;
            })(),
            ...request.body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
    },
    onError: (error) => {
      if (error instanceof ChatbotError) {
        toast({
          type: "error",
          description: error.message,
        });
      }
    },
  });

  const searchParams = useSearchParams();
  const query = searchParams.get("query");

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      setHasCompletedIntake(true);
      sendMessage({
        role: "user" as const,
        parts: [{ type: "text", text: query }],
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, "", `/chat/${id}`);
    }
  }, [query, sendMessage, hasAppendedQuery, id]);

  const { data: votes } = useSWR<Vote[]>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher,
  );

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);
  const { setArtifact } = useArtifact();

  useEffect(() => {
    if (initialProfileDocumentId) {
      setArtifact((current) => ({
        ...current,
        documentId: initialProfileDocumentId,
        kind: "profiles",
        title: "Your Matches",
        status: "idle",
        isVisible: true,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProfileDocumentId]);

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });

  const showIntakeForm =
    !isReadonly && !hasCompletedIntake && messages.length === 0 && !query;

  const handleIntakeSubmit = (prompt: string) => {
    setHasCompletedIntake(true);
    forceGenerateProfilesRef.current = true;
    window.history.pushState({}, "", `/chat/${id}`);
    sendMessage({
      role: "user",
      parts: [{ type: "text", text: `${INTAKE_MESSAGE_PREFIX}${prompt}` }],
    });

    // Keep intake payload out of visible chat history while still allowing backend generation.
    setTimeout(() => {
      setMessages((current) =>
        current.filter(
          (message) =>
            !(
              message.role === "user" &&
              message.parts.some(
                (part) =>
                  part.type === "text" &&
                  part.text.startsWith(INTAKE_MESSAGE_PREFIX),
              )
            ),
        ),
      );
    }, 0);
  };

  return (
    <>
      <div className="overscroll-behavior-contain flex h-dvh w-full min-w-0 flex-1 touch-pan-y flex-col bg-background">
        <ChatHeader
          chatId={id}
          isReadonly={isReadonly}
          selectedVisibilityType={initialVisibilityType}
        />

        {showIntakeForm ? (
          <IntakeForm
            isSubmitting={status !== "ready"}
            onSubmit={handleIntakeSubmit}
          />
        ) : (
          <Messages
            addToolApprovalResponse={addToolApprovalResponse}
            chatId={id}
            isArtifactVisible={isArtifactVisible}
            isReadonly={isReadonly}
            messages={messages}
            regenerate={regenerate}
            selectedModelId={initialChatModel}
            setMessages={setMessages}
            status={status}
            votes={votes}
          />
        )}

        <div className="sticky bottom-0 z-1 mx-auto flex w-full max-w-4xl gap-2 border-t-0 bg-background px-2 pb-3 md:px-4 md:pb-4">
          {!isReadonly && !showIntakeForm && (
            <MultimodalInput
              attachments={attachments}
              chatId={id}
              input={input}
              messages={messages}
              selectedModelId={initialChatModel}
              selectedVisibilityType={visibilityType}
              sendMessage={sendMessage}
              setAttachments={setAttachments}
              setInput={setInput}
              setMessages={setMessages}
              status={status}
              stop={stop}
            />
          )}
        </div>
      </div>

      <Artifact
        addToolApprovalResponse={addToolApprovalResponse}
        attachments={attachments}
        chatId={id}
        input={input}
        isReadonly={isReadonly}
        messages={messages}
        regenerate={regenerate}
        selectedModelId={initialChatModel}
        selectedVisibilityType={visibilityType}
        sendMessage={sendMessage}
        setAttachments={setAttachments}
        setInput={setInput}
        setMessages={setMessages}
        status={status}
        stop={stop}
        votes={votes}
      />
    </>
  );
}
