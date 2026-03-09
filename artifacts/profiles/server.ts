import { generateText } from "ai";
import {
  buildProfileUpdatePrompt,
  profileGenerationSystemPrompt,
  profileUpdateSystemPrompt,
} from "@/lib/ai/prompts";
import { getArtifactModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

export const profilesDocumentHandler = createDocumentHandler<"profiles">({
  kind: "profiles",
  // onCreateDocument is not the primary creation path — the generateProfiles
  // tool handles initial creation with structured preference input.
  // This handler is registered for updateDocument support.
  onCreateDocument: async ({ title, dataStream }) => {
    const { text } = await generateText({
      model: getArtifactModel(),
      system: profileGenerationSystemPrompt,
      prompt: `Generate 4 romantic partner profiles with one close_match, one moderate_stretch, one exploratory, and one anti_match. Title context: ${title}`,
    });

    dataStream.write({
      type: "data-textDelta",
      data: text,
      transient: true,
    });

    return text;
  },

  onUpdateDocument: async ({ document, description, dataStream }) => {
    const prompt = buildProfileUpdatePrompt(
      document.content ?? "{}",
      description
    );

    const { text } = await generateText({
      model: getArtifactModel(),
      system: profileUpdateSystemPrompt,
      prompt,
    });

    dataStream.write({
      type: "data-textDelta",
      data: text,
      transient: true,
    });

    return text;
  },
});
