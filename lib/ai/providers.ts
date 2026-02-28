import { gateway } from "@ai-sdk/gateway";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { isTestEnvironment } from "../constants";

const THINKING_SUFFIX_REGEX = /-thinking$/;
const DEFAULT_DIRECT_GOOGLE_MODEL = "gemini-2.5-flash-lite";

const hasAiGatewayApiKey = Boolean(process.env.AI_GATEWAY_API_KEY);
const hasGoogleApiKey = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);

const google = hasGoogleApiKey
  ? createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    })
  : null;

function getGoogleModelId(modelId: string) {
  if (!modelId.startsWith("google/")) {
    return DEFAULT_DIRECT_GOOGLE_MODEL;
  }

  return modelId.slice("google/".length);
}

function getLanguageModelFromConfiguredProvider(modelId: string) {
  if (hasAiGatewayApiKey) {
    return gateway.languageModel(modelId);
  }

  if (google) {
    return google(getGoogleModelId(modelId));
  }

  throw new Error(
    "Missing AI provider credentials. Set AI_GATEWAY_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY."
  );
}

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        reasoningModel,
        titleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "chat-model-reasoning": reasoningModel,
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : null;

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }

  const isReasoningModel =
    modelId.includes("reasoning") || modelId.endsWith("-thinking");

  if (isReasoningModel && !hasAiGatewayApiKey && google) {
    return google(DEFAULT_DIRECT_GOOGLE_MODEL);
  }

  if (isReasoningModel) {
    const gatewayModelId = modelId.replace(THINKING_SUFFIX_REGEX, "");

    return wrapLanguageModel({
      model: gateway.languageModel(gatewayModelId),
      middleware: extractReasoningMiddleware({ tagName: "thinking" }),
    });
  }

  return getLanguageModelFromConfiguredProvider(modelId);
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }

  if (hasAiGatewayApiKey) {
    return gateway.languageModel("google/gemini-2.5-flash-lite");
  }

  if (google) {
    return google(DEFAULT_DIRECT_GOOGLE_MODEL);
  }

  throw new Error(
    "Missing AI provider credentials. Set AI_GATEWAY_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY."
  );
}

export function getArtifactModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("artifact-model");
  }

  if (hasAiGatewayApiKey) {
    return gateway.languageModel("anthropic/claude-haiku-4.5");
  }

  if (google) {
    return google(DEFAULT_DIRECT_GOOGLE_MODEL);
  }

  throw new Error(
    "Missing AI provider credentials. Set AI_GATEWAY_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY."
  );
}
