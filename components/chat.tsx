"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { ChatHeader } from "@/components/chat-header";
import { useAutoResume } from "@/hooks/use-auto-resume";
import { INTAKE_MESSAGE_PREFIX } from "@/lib/constants";
import type { Vote } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import type { Attachment, ChatMessage } from "@/lib/types";
import { fetcher, fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
import { useDataStream } from "./data-stream-provider";
import { IntakeForm } from "./intake-form";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { toast } from "./toast";
import type { VisibilityType } from "./visibility-selector";

const MAX_CHAT_REQUEST_CHARS = 7_500_000;
const MIN_MESSAGES_TO_KEEP = 8;

function estimatePayloadChars(messages: ChatMessage[]) {
  try {
    return JSON.stringify(messages).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function stripProfilePhotoDataFromMessages(messages: ChatMessage[]) {
  return messages.map((message) => ({
    ...message,
    parts: message.parts.map((part) => {
      if (part.type !== "tool-generateProfiles") {
        return part;
      }

      const rawOutput = (part as { output?: unknown }).output;

      if (!rawOutput || typeof rawOutput !== "object") {
        return part;
      }

      const output = rawOutput as {
        profileSet?: {
          profiles?: Array<Record<string, unknown>>;
          preferencesSummary?: string;
          generatedAt?: string;
        };
        profiles?: Array<Record<string, unknown>>;
      };

      const stripPhoto = (profile: Record<string, unknown>) => {
        const { profilePhotoDataUrl: _profilePhotoDataUrl, ...rest } = profile;
        return rest;
      };

      const nextProfileSet = output.profileSet
        ? {
            ...output.profileSet,
            profiles: Array.isArray(output.profileSet.profiles)
              ? output.profileSet.profiles.map(stripPhoto)
              : output.profileSet.profiles,
          }
        : undefined;

      const nextProfiles = Array.isArray(output.profiles)
        ? output.profiles.map(stripPhoto)
        : output.profiles;

      const sanitizedPart = {
        ...part,
        output: {
          ...output,
          ...(nextProfileSet ? { profileSet: nextProfileSet } : {}),
          ...(nextProfiles ? { profiles: nextProfiles } : {}),
        },
      };

      return sanitizedPart as unknown as ChatMessage["parts"][number];
    }),
  })) as ChatMessage[];
}

function sanitizeMessagesForRequest(messages: ChatMessage[]) {
  const stripped = stripProfilePhotoDataFromMessages(messages);

  if (estimatePayloadChars(stripped) <= MAX_CHAT_REQUEST_CHARS) {
    return stripped;
  }

  const trimmed = [...stripped];

  // Drop oldest history first while keeping recent context intact.
  while (
    trimmed.length > MIN_MESSAGES_TO_KEEP &&
    estimatePayloadChars(trimmed) > MAX_CHAT_REQUEST_CHARS
  ) {
    trimmed.shift();
  }

  return trimmed;
}

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  autoResume,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  autoResume: boolean;
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
            Boolean(part) &&
            typeof part === "object" &&
            "state" in part &&
            (part as { state?: string }).state === "approval-responded" &&
            "approval" in part &&
            ((part as { approval?: { approved?: boolean } }).approval
              ?.approved ?? false) === true,
        ) ?? false;
      return shouldContinue;
    },
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest(request) {
        const sanitizedMessages = sanitizeMessagesForRequest(request.messages);
        const lastMessage = sanitizedMessages.at(-1);

        return {
          body: {
            id: request.id,
            message: lastMessage,
            messages: sanitizedMessages,
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
    // The intake message is already hidden from the UI by isHiddenIntakeMessage
    // in messages.tsx — no need to remove it from state. Keeping it ensures the
    // model retains the original preferences as context for future requests.
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

    </>
  );
}
