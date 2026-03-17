import { geolocation } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  stepCountIs,
  streamText,
} from "ai";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream/generic";
import { auth, type UserType } from "@/app/(auth)/auth";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import { resolveChatModelId } from "@/lib/ai/models";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocument } from "@/lib/ai/tools/create-document";
import { generateProfiles } from "@/lib/ai/tools/generate-profiles";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { INTAKE_MESSAGE_PREFIX, isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatTitleById,
  updateMessage,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;
const EMPTY_ASSISTANT_FALLBACK_TEXT =
  "I couldn't generate a response for that request. Please try again.";

function hasVisibleAssistantContent(message: ChatMessage) {
  return message.parts.some((part) => {
    if (part.type === "text") {
      return part.text?.trim().length > 0;
    }

    if (part.type === "reasoning") {
      return part.text?.trim().length > 0;
    }

    return part.type.startsWith("tool-");
  });
}

function normalizeAssistantMessage(message: ChatMessage): ChatMessage {
  if (message.role !== "assistant" || hasVisibleAssistantContent(message)) {
    return message;
  }

  return {
    ...message,
    parts: [
      ...message.parts,
      {
        type: "text",
        text: EMPTY_ASSISTANT_FALLBACK_TEXT,
      },
    ],
  };
}

function getStreamErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "I ran into an unexpected issue. Please try again.";
  }

  const message = error.message?.toLowerCase() ?? "";

  if (
    message.includes("quota") ||
    message.includes("resource_exhausted") ||
    message.includes("statuscode: 429") ||
    message.includes("rate limit")
  ) {
    return "I hit the provider quota/rate limit. Please wait a bit and try again, or switch to another model/provider.";
  }

  return "I couldn't generate a response right now. Please try again.";
}

function getStreamContext() {
  try {
    return createResumableStreamContext({ waitUntil: after });
  } catch (_) {
    return null;
  }
}

export { getStreamContext };

function isToolApprovalFlowMessageSet(messages?: ChatMessage[]) {
  if (!messages || messages.length === 0) {
    return false;
  }

  return messages.some((msg) =>
    msg.parts?.some((part) => {
      const state = (part as { state?: string }).state;
      return state === "approval-responded" || state === "output-denied";
    })
  );
}

type ActiveToolName =
  | "getWeather"
  | "createDocument"
  | "updateDocument"
  | "requestSuggestions"
  | "generateProfiles";

const SAFE_PART_TYPES = new Set(["text", "reasoning"]);

function stripNonTextParts(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .map((msg) => ({
      ...msg,
      parts: msg.parts.filter((part) =>
        SAFE_PART_TYPES.has((part as { type: string }).type)
      ) as ChatMessage["parts"],
    }))
    .filter((msg) => msg.parts.length > 0);
}

function getUserTextFromMessages(messages: ChatMessage[]) {
  return messages
    .filter((m) => m.role === "user")
    .flatMap((m) => m.parts)
    .filter((part): part is Extract<ChatMessage["parts"][number], { type: "text" }> =>
      part.type === "text"
    )
    .map((part) => part.text)
    .filter((text): text is string => Boolean(text && text.trim().length > 0));
}

function stripIntakePrefix(text: string) {
  return text.startsWith(INTAKE_MESSAGE_PREFIX)
    ? text.slice(INTAKE_MESSAGE_PREFIX.length)
    : text;
}

function normalizeIntakeMessageForModel(message: ChatMessage | undefined) {
  if (!message || message.role !== "user") {
    return message;
  }

  return {
    ...message,
    parts: message.parts.map((part) => {
      if (part.type !== "text") {
        return part;
      }

      return {
        ...part,
        text: stripIntakePrefix(part.text),
      };
    }),
  };
}

function hasIntakePrefix(message: ChatMessage | undefined) {
  if (!message || message.role !== "user") {
    return false;
  }

  return message.parts.some(
    (part) => part.type === "text" && part.text.startsWith(INTAKE_MESSAGE_PREFIX),
  );
}

function buildMatchmakingRuntimeGuidance({
  uiMessages,
  canUseTools,
  forceGenerateProfiles,
}: {
  uiMessages: ChatMessage[];
  canUseTools: boolean;
  forceGenerateProfiles?: boolean;
}) {
  if (forceGenerateProfiles && canUseTools) {
    return `\n\nRuntime conversation guidance:\n- The user just completed an intake form and is ready for immediate results.\n- Start with one short line of acknowledgment in a warm tone, e.g. \"Thanks for sharing - I generated profiles based on your preferences.\"\n- Then call generateProfiles now without asking additional intake questions.`;
  }

  const userTexts = getUserTextFromMessages(uiMessages);

  if (userTexts.length === 0) {
    return "";
  }

  const conversation = userTexts.join("\n").toLowerCase();
  const hasRelationshipGoal =
    /\b(friendship|platonic|serious|committed|casual|marriage|open|exploring|long[-\s]?term)\b/.test(
      conversation
    );
  const asksForMatches =
    /\b(matches|matchmaking|potential matches|generate profiles|show me matches|find me matches)\b/.test(
      conversation
    );
  const hasTraitsOrValues =
    /\b(i value|qualities|kindness|kind|friendly|friendliness|values|personality|looking for)\b/.test(
      conversation
    );

  const hasEnoughContext =
    hasRelationshipGoal &&
    (asksForMatches || hasTraitsOrValues || userTexts.length >= 4);

  if (!canUseTools && hasEnoughContext) {
    return `\n\nRuntime conversation guidance:\n- Do not repeat opening questions.\n- The user has already provided enough direction to continue.\n- Briefly acknowledge their preferences and ask ONE new, non-redundant question that adds missing details.`;
  }

  if (!hasEnoughContext) {
    return "";
  }

  return `\n\nRuntime conversation guidance:\n- The user has already shared relationship intent and meaningful preferences.\n- Do NOT ask again what kind of connection they are looking for.\n- Use best-effort inference for missing fields and call generateProfiles now.`;
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;
  const hasDatabase = Boolean(process.env.POSTGRES_URL);

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  try {
    const {
      id,
      message,
      messages,
      selectedChatModel,
      selectedVisibilityType,
      forceGenerateProfiles,
    } =
      requestBody;
    const resolvedChatModel = resolveChatModelId(selectedChatModel);

    const session = await auth();

    if (!session?.user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }

    const userType: UserType = session.user.type;

    const messageCount = hasDatabase
      ? await getMessageCountByUserId({
          id: session.user.id,
          differenceInHours: 24,
        })
      : 0;

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatbotError("rate_limit:chat").toResponse();
    }

    const incomingMessages = Array.isArray(messages)
      ? (messages as ChatMessage[])
      : undefined;
    const normalizedMessage = normalizeIntakeMessageForModel(
      message as ChatMessage | undefined,
    );
    const isHiddenIntakeSubmission = hasIntakePrefix(
      message as ChatMessage | undefined,
    );
    const isToolApprovalFlow = isToolApprovalFlowMessageSet(incomingMessages);

    const chat = hasDatabase ? await getChatById({ id }) : null;
    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | null = null;

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatbotError("forbidden:chat").toResponse();
      }
      if (!isToolApprovalFlow && hasDatabase) {
        messagesFromDb = await getMessagesByChatId({ id });
      }
    } else if (normalizedMessage?.role === "user") {
      if (hasDatabase) {
        await saveChat({
          id,
          userId: session.user.id,
          title: "New chat",
          visibility: selectedVisibilityType,
        });
      }
      titlePromise =
        hasDatabase && !isHiddenIntakeSubmission
          ? generateTitleFromUserMessage({ message: normalizedMessage })
          : null;
    }

    const uiMessages =
      !hasDatabase && incomingMessages?.length
        ? stripNonTextParts(incomingMessages)
        : isToolApprovalFlow
          ? (incomingMessages ?? [])
          : [...convertToUIMessages(messagesFromDb), normalizedMessage as ChatMessage];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    if (normalizedMessage?.role === "user" && !isHiddenIntakeSubmission) {
      if (hasDatabase) {
        await saveMessages({
          messages: [
            {
              chatId: id,
              id: normalizedMessage.id,
              role: "user",
              parts: normalizedMessage.parts,
              attachments: [],
              createdAt: new Date(),
            },
          ],
        });
      }
    }

    const isReasoningModel =
      resolvedChatModel.includes("reasoning") ||
      resolvedChatModel.includes("thinking");

    const modelMessages = await convertToModelMessages(uiMessages);
    const activeTools: ActiveToolName[] = isReasoningModel
      ? []
      : [
          "getWeather",
          "createDocument",
          "updateDocument",
          "requestSuggestions",
          ...(
            modelMessages.length >= 3 || forceGenerateProfiles
              ? (["generateProfiles"] as const)
              : []
          ),
        ];

    const runtimeGuidance = buildMatchmakingRuntimeGuidance({
      uiMessages,
      canUseTools: !isReasoningModel,
      forceGenerateProfiles,
    });
    const forcedToolChoice =
      forceGenerateProfiles && !isReasoningModel
        ? ({ type: "tool", toolName: "generateProfiles" } as const)
        : undefined;
    const maxStepCount = forceGenerateProfiles ? 1 : 5;

    const stream = createUIMessageStream({
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
      execute: async ({ writer: dataStream }) => {
        const result = streamText({
          model: getLanguageModel(resolvedChatModel),
          maxRetries: 0,
          system: `${systemPrompt({ selectedChatModel: resolvedChatModel, requestHints })}${runtimeGuidance}`,
          messages: modelMessages,
          stopWhen: stepCountIs(maxStepCount),
          toolChoice: forcedToolChoice,
          experimental_activeTools: activeTools,
          providerOptions: isReasoningModel
            ? {
                anthropic: {
                  thinking: { type: "enabled", budgetTokens: 10_000 },
                },
              }
            : undefined,
          tools: {
            getWeather,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({ session, dataStream }),
            generateProfiles: generateProfiles({ session, chatId: id }),
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-text",
          },
        });

        dataStream.merge(result.toUIMessageStream({ sendReasoning: true }));

        if (titlePromise) {
          const title = await titlePromise;
          dataStream.write({ type: "data-chat-title", data: title });
          if (hasDatabase) {
            updateChatTitleById({ chatId: id, title });
          }
        }
      },
      generateId: generateUUID,
      onFinish: async ({ messages: finishedMessages }) => {
        const normalizedFinishedMessages = finishedMessages.map((message) =>
          normalizeAssistantMessage(message as ChatMessage)
        );

        if (!hasDatabase) {
          return;
        }

        if (isToolApprovalFlow) {
          for (const finishedMsg of normalizedFinishedMessages) {
            const existingMsg = uiMessages.find((m) => m.id === finishedMsg.id);
            if (existingMsg) {
              await updateMessage({
                id: finishedMsg.id,
                parts: finishedMsg.parts,
              });
            } else {
              await saveMessages({
                messages: [
                  {
                    id: finishedMsg.id,
                    role: finishedMsg.role,
                    parts: finishedMsg.parts,
                    createdAt: new Date(),
                    attachments: [],
                    chatId: id,
                  },
                ],
              });
            }
          }
        } else if (normalizedFinishedMessages.length > 0) {
          await saveMessages({
            messages: normalizedFinishedMessages.map((currentMessage) => ({
              id: currentMessage.id,
              role: currentMessage.role,
              parts: currentMessage.parts,
              createdAt: new Date(),
              attachments: [],
              chatId: id,
            })),
          });
        }
      },
      onError: (error) => getStreamErrorMessage(error),
    });

    return createUIMessageStreamResponse({
      stream,
      async consumeSseStream({ stream: sseStream }) {
        if (!process.env.REDIS_URL) {
          return;
        }
        try {
          const streamContext = getStreamContext();
          if (streamContext) {
            const streamId = generateId();
            await createStreamId({ streamId, chatId: id });
            await streamContext.createNewResumableStream(
              streamId,
              () => sseStream
            );
          }
        } catch (_) {
          // ignore redis errors
        }
      },
    });
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatbotError) {
      return error.toResponse();
    }

    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests"
      )
    ) {
      return new ChatbotError("bad_request:activate_gateway").toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatbotError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  if (!process.env.POSTGRES_URL) {
    return Response.json({ deleted: false, reason: "database_not_configured" });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
