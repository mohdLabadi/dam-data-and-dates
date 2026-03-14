// Curated list of supported Google models
export const DEFAULT_CHAT_MODEL = "google/gemini-2.5-flash-lite";
const GOOGLE_MODEL_QUOTA_EXHAUSTED = "google/gemini-2.5-flash-lite";
const GOOGLE_MODEL_FALLBACK = "google/gemini-2.5-flash-lite";

type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
};

const allChatModels: ChatModel[] = [
  {
    id: "google/gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    provider: "google",
    description: "Ultra fast and affordable",
  },
  {
    id: "google/gemini-3-pro-preview",
    name: "Gemini 3 Pro",
    provider: "google",
    description: "Most capable Google model",
  },
];

const chatModels: ChatModel[] = allChatModels;

export function resolveChatModelId(modelId?: string) {
  if (!modelId) {
    return GOOGLE_MODEL_FALLBACK;
  }

  if (modelId === GOOGLE_MODEL_QUOTA_EXHAUSTED) {
    return GOOGLE_MODEL_FALLBACK;
  }

  const isKnownModel = chatModels.some((model) => model.id === modelId);

  if (!isKnownModel) {
    return GOOGLE_MODEL_FALLBACK;
  }

  return modelId;
}
