"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import { useState } from "react";
import type { Vote } from "@/lib/db/schema";
import type { PartnerProfile } from "@/lib/ai/preference-schema";
import type { ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";
import { useDataStream } from "./data-stream-provider";
import { DocumentToolResult } from "./document";
import { DocumentPreview } from "./document-preview";
import { MessageContent } from "./elements/message";
import { Response } from "./elements/response";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "./elements/tool";
import { SparklesIcon } from "./icons";
import { MessageEditor } from "./message-editor";
import { MessageReasoning } from "./message-reasoning";
import { PreviewAttachment } from "./preview-attachment";
import { Weather } from "./weather";

const EMPTY_ASSISTANT_FALLBACK_TEXT =
  "I couldn't generate a response for that request. Please try again.";

function InlineMatchCard({
  profile,
  onLike,
  onDislike,
}: {
  profile: PartnerProfile;
  onLike: (profile: PartnerProfile) => void;
  onDislike: (profile: PartnerProfile) => void;
}) {
  const traits = Array.isArray(profile.traits) ? profile.traits : [];

  return (
    <div className="mb-4 rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-base">
          {profile.name}, {profile.age}
        </h3>
        <span className="text-muted-foreground text-sm">
          {profile.compatibilityScore}%
        </span>
      </div>
      <p className="mb-2 text-muted-foreground text-sm">
        {profile.location} · {profile.occupation}
      </p>
      <p className="mb-3 text-sm">{profile.bio}</p>
      {traits.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {traits.slice(0, 5).map((trait) => (
            <span
              className="rounded-full bg-muted px-2 py-0.5 text-xs"
              key={trait}
            >
              {trait}
            </span>
          ))}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          onClick={() => onDislike(profile)}
          type="button"
        >
          👎 Not for me
        </button>
        <button
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          onClick={() => onLike(profile)}
          type="button"
        >
          👍 This is promising
        </button>
      </div>
    </div>
  );
}

const PurePreviewMessage = ({
  addToolApprovalResponse,
  chatId: _chatId,
  message,
  vote: _vote,
  isLoading,
  setMessages,
  regenerate,
  sendMessage,
  isReadonly,
  requiresScrollPadding: _requiresScrollPadding,
}: {
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  chatId: string;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  sendMessage?: UseChatHelpers<ChatMessage>["sendMessage"];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
}) => {
  const [mode, setMode] = useState<"view" | "edit">("view");

  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === "file",
  );
  const hasVisibleAssistantContent =
    message.role === "assistant" &&
    message.parts.some((part) => {
      if (part.type === "text") {
        return part.text?.trim().length > 0;
      }

      if (part.type === "reasoning") {
        return part.text?.trim().length > 0;
      }

      return part.type.startsWith("tool-");
    });

  useDataStream();

  return (
    <div
      className="group/message fade-in w-full animate-in duration-200"
      data-role={message.role}
      data-testid={`message-${message.role}`}
    >
      <div
        className={cn("flex w-full items-start gap-2 md:gap-3", {
          "justify-end": message.role === "user" && mode !== "edit",
          "justify-start": message.role === "assistant",
        })}
      >
        {message.role === "assistant" && (
          <div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
            <SparklesIcon size={14} />
          </div>
        )}

        <div
          className={cn("flex flex-col", {
            "gap-2 md:gap-4": message.parts?.some(
              (p) => p.type === "text" && p.text?.trim(),
            ),
            "w-full":
              (message.role === "assistant" &&
                (message.parts?.some(
                  (p) => p.type === "text" && p.text?.trim(),
                ) ||
                  message.parts?.some((p) => p.type.startsWith("tool-")))) ||
              mode === "edit",
            "max-w-[calc(100%-2.5rem)] sm:max-w-[min(fit-content,80%)]":
              message.role === "user" && mode !== "edit",
          })}
        >
          {attachmentsFromMessage.length > 0 && (
            <div
              className="flex flex-row justify-end gap-2"
              data-testid={"message-attachments"}
            >
              {attachmentsFromMessage.map((attachment) => (
                <PreviewAttachment
                  attachment={{
                    name: attachment.filename ?? "file",
                    contentType: attachment.mediaType,
                    url: attachment.url,
                  }}
                  key={attachment.url}
                />
              ))}
            </div>
          )}

          {message.parts?.map((part, index) => {
            if (!part || typeof part !== "object") {
              return null;
            }

            const { type } = part;
            const key = `message-${message.id}-part-${index}`;

            if (type === "reasoning") {
              const hasContent = part.text?.trim().length > 0;
              const isStreaming =
                "state" in part &&
                (part as { state?: string }).state === "streaming";
              if (hasContent || isStreaming) {
                return (
                  <MessageReasoning
                    isLoading={isLoading || isStreaming}
                    key={key}
                    reasoning={part.text || ""}
                  />
                );
              }
            }

            if (type === "text") {
              if (mode === "view") {
                return (
                  <div key={key}>
                    <MessageContent
                      className={cn({
                        "wrap-break-word w-fit rounded-2xl px-3 py-2 text-right text-[#ece7e6]":
                          message.role === "user",
                        "bg-transparent px-0 py-0 text-left":
                          message.role === "assistant",
                      })}
                      data-testid="message-content"
                      style={
                        message.role === "user"
                          ? { backgroundColor: "#550000" }
                          : undefined
                      }
                    >
                      <Response>
                        {sanitizeText(
                          message.role === "user"
                            ? part.text.replace(
                                /\s*Use updateDocument with id [a-f0-9-]+\.?/g,
                                "",
                              )
                            : part.text,
                        )}
                      </Response>
                    </MessageContent>
                  </div>
                );
              }

              if (mode === "edit") {
                return (
                  <div
                    className="flex w-full flex-row items-start gap-3"
                    key={key}
                  >
                    <div className="size-8" />
                    <div className="min-w-0 flex-1">
                      <MessageEditor
                        key={message.id}
                        message={message}
                        regenerate={regenerate}
                        setMessages={setMessages}
                        setMode={setMode}
                      />
                    </div>
                  </div>
                );
              }
            }

            if (type === "tool-getWeather") {
              const { toolCallId, state } = part;
              const approvalId = (part as { approval?: { id: string } })
                .approval?.id;
              const isDenied =
                state === "output-denied" ||
                (state === "approval-responded" &&
                  (part as { approval?: { approved?: boolean } }).approval
                    ?.approved === false);
              const widthClass = "w-[min(100%,450px)]";

              if (state === "output-available") {
                return (
                  <div className={widthClass} key={toolCallId}>
                    <Weather weatherAtLocation={part.output} />
                  </div>
                );
              }

              if (isDenied) {
                return (
                  <div className={widthClass} key={toolCallId}>
                    <Tool className="w-full" defaultOpen={true}>
                      <ToolHeader
                        state="output-denied"
                        type="tool-getWeather"
                      />
                      <ToolContent>
                        <div className="px-4 py-3 text-muted-foreground text-sm">
                          Weather lookup was denied.
                        </div>
                      </ToolContent>
                    </Tool>
                  </div>
                );
              }

              if (state === "approval-responded") {
                return (
                  <div className={widthClass} key={toolCallId}>
                    <Tool className="w-full" defaultOpen={true}>
                      <ToolHeader state={state} type="tool-getWeather" />
                      <ToolContent>
                        <ToolInput input={part.input} />
                      </ToolContent>
                    </Tool>
                  </div>
                );
              }

              return (
                <div className={widthClass} key={toolCallId}>
                  <Tool className="w-full" defaultOpen={true}>
                    <ToolHeader state={state} type="tool-getWeather" />
                    <ToolContent>
                      {(state === "input-available" ||
                        state === "approval-requested") && (
                        <ToolInput input={part.input} />
                      )}
                      {state === "approval-requested" && approvalId && (
                        <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
                          <button
                            className="rounded-md px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
                            onClick={() => {
                              addToolApprovalResponse({
                                id: approvalId,
                                approved: false,
                                reason: "User denied weather lookup",
                              });
                            }}
                            type="button"
                          >
                            Deny
                          </button>
                          <button
                            className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-sm transition-colors hover:bg-primary/90"
                            onClick={() => {
                              addToolApprovalResponse({
                                id: approvalId,
                                approved: true,
                              });
                            }}
                            type="button"
                          >
                            Allow
                          </button>
                        </div>
                      )}
                    </ToolContent>
                  </Tool>
                </div>
              );
            }

            if (type === "tool-generateProfiles") {
              const { toolCallId, state } = part;

              if (state !== "output-available") {
                return (
                  <div
                    className="flex h-24 items-center justify-center"
                    key={toolCallId}
                  >
                    <div className="text-center">
                      <div className="mb-2 text-3xl">💘</div>
                      <p className="text-sm text-muted-foreground">
                        Crafting your matches...
                      </p>
                    </div>
                  </div>
                );
              }

              const rawOutput = (part as { output?: unknown }).output as
                | {
                    profileSet?: {
                      profiles?: PartnerProfile[];
                      preferencesSummary?: string;
                    };
                    profiles?: PartnerProfile[];
                    preferencesSummary?: string;
                    message?: string;
                  }
                | undefined;

              const profileSet =
                rawOutput?.profileSet ??
                (rawOutput?.profiles
                  ? {
                      profiles: rawOutput.profiles,
                      preferencesSummary: rawOutput.preferencesSummary,
                    }
                  : null);

              if (!profileSet?.profiles?.length) {
                return (
                  <div
                    className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground"
                    key={toolCallId}
                  >
                    <p className="mb-2">
                      {rawOutput?.message ??
                        "Matches were generated, but no profile cards were returned in the expected format."}
                    </p>
                    <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
                      {JSON.stringify(rawOutput ?? {}, null, 2)}
                    </pre>
                  </div>
                );
              }

              return (
                <div className="w-full" key={toolCallId}>
                  {profileSet.preferencesSummary && (
                    <p className="mb-4 text-sm text-muted-foreground">
                      {profileSet.preferencesSummary}
                    </p>
                  )}
                  {profileSet.profiles.map((profile) => (
                    <InlineMatchCard
                      key={profile.id}
                      profile={profile}
                      onLike={(p) =>
                        sendMessage?.({
                          role: "user",
                          parts: [
                            {
                              type: "text",
                              text: `I liked ${p.name}'s profile (${p.type.replace("_", " ")}). Their traits that stood out: ${p.traits.slice(0, 3).join(", ")}. Please regenerate all four profiles with more matches like this one.`,
                            },
                          ],
                        })
                      }
                      onDislike={(p) =>
                        sendMessage?.({
                          role: "user",
                          parts: [
                            {
                              type: "text",
                              text: `I didn't connect with ${p.name}'s profile. Please regenerate all four profiles and avoid the qualities that made this one feel off.`,
                            },
                          ],
                        })
                      }
                    />
                  ))}
                </div>
              );
            }

            if (type === "tool-createDocument") {
              const { toolCallId } = part;

              if (part.output && "error" in part.output) {
                return (
                  <div
                    className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
                    key={toolCallId}
                  >
                    Error creating document: {String(part.output.error)}
                  </div>
                );
              }

              return (
                <DocumentPreview
                  isReadonly={isReadonly}
                  key={toolCallId}
                  result={part.output}
                />
              );
            }

            if (type === "tool-updateDocument") {
              const { toolCallId } = part;

              if (part.output && "error" in part.output) {
                return (
                  <div
                    className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
                    key={toolCallId}
                  >
                    Error updating document: {String(part.output.error)}
                  </div>
                );
              }

              return (
                <div className="relative" key={toolCallId}>
                  <DocumentPreview
                    args={{ ...part.output, isUpdate: true }}
                    isReadonly={isReadonly}
                    result={part.output}
                  />
                </div>
              );
            }

            if (type === "tool-requestSuggestions") {
              const { toolCallId, state } = part;

              return (
                <Tool defaultOpen={true} key={toolCallId}>
                  <ToolHeader state={state} type="tool-requestSuggestions" />
                  <ToolContent>
                    {state === "input-available" && (
                      <ToolInput input={part.input} />
                    )}
                    {state === "output-available" && (
                      <ToolOutput
                        errorText={undefined}
                        output={
                          "error" in part.output ? (
                            <div className="rounded border p-2 text-red-500">
                              Error: {String(part.output.error)}
                            </div>
                          ) : (
                            <DocumentToolResult
                              isReadonly={isReadonly}
                              result={part.output}
                              type="request-suggestions"
                            />
                          )
                        }
                      />
                    )}
                  </ToolContent>
                </Tool>
              );
            }

            return null;
          })}

          {message.role === "assistant" &&
            !isLoading &&
            !hasVisibleAssistantContent && (
              <div>
                <MessageContent
                  className="bg-transparent px-0 py-0 text-left"
                  data-testid="message-content"
                >
                  <Response>{EMPTY_ASSISTANT_FALLBACK_TEXT}</Response>
                </MessageContent>
              </div>
            )}

          {/* Message actions (copy/like/dislike) removed for profile interface */}
        </div>
      </div>
    </div>
  );
};

export const PreviewMessage = PurePreviewMessage;

export const ThinkingMessage = () => {
  return (
    <div
      className="group/message fade-in w-full animate-in duration-300"
      data-role="assistant"
      data-testid="message-assistant-loading"
    >
      <div className="flex items-start justify-start gap-3">
        <div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
          <div className="animate-pulse">
            <SparklesIcon size={14} />
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 md:gap-4">
          <div className="flex items-center gap-1 p-0 text-muted-foreground text-sm">
            <span className="animate-pulse">Thinking</span>
            <span className="inline-flex">
              <span className="animate-bounce [animation-delay:0ms]">.</span>
              <span className="animate-bounce [animation-delay:150ms]">.</span>
              <span className="animate-bounce [animation-delay:300ms]">.</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
