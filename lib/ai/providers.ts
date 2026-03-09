import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  customProvider,
  type ImageModel,
} from "ai";
import { isTestEnvironment } from "../constants";

const DEFAULT_DIRECT_GOOGLE_MODEL = "gemini-2.5-flash-lite";
const DEFAULT_DIRECT_GOOGLE_IMAGE_MODEL = "gemini-2.5-flash-image";
const DEFAULT_NANO_BANANA_IMAGE_MODEL = "gemini-2.5-flash-image";
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

function getGoogleImageModelId(modelId: string) {
  if (!modelId.startsWith("google/")) {
    return modelId || DEFAULT_DIRECT_GOOGLE_IMAGE_MODEL;
  }

  return modelId.slice("google/".length) || DEFAULT_DIRECT_GOOGLE_IMAGE_MODEL;
}

function getLanguageModelFromConfiguredProvider(modelId: string) {
  if (google) {
    return google(getGoogleModelId(modelId));
  }

  throw new Error("Missing AI provider credentials. Set GOOGLE_GENERATIVE_AI_API_KEY.");
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

  return getLanguageModelFromConfiguredProvider(modelId);
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }

  if (google) {
    return google(DEFAULT_DIRECT_GOOGLE_MODEL);
  }

  throw new Error("Missing AI provider credentials. Set GOOGLE_GENERATIVE_AI_API_KEY.");
}

export function getArtifactModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("artifact-model");
  }

  if (google) {
    return google(DEFAULT_DIRECT_GOOGLE_MODEL);
  }

  throw new Error("Missing AI provider credentials. Set GOOGLE_GENERATIVE_AI_API_KEY.");
}

export function getProfilePhotoImageModel(): ImageModel | null {
  const modelId =
    process.env.NANO_BANANA_IMAGE_MODEL ?? DEFAULT_NANO_BANANA_IMAGE_MODEL;

  if (google) {
    return google.imageModel(getGoogleImageModelId(modelId));
  }

  return null;
}
