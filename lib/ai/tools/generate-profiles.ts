import { generateText, tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import {
  buildProfileGenerationPrompt,
  profileGenerationSystemPrompt,
} from "@/lib/ai/prompts";
import { generateProfilePhotoDataUrl } from "@/lib/ai/profile-photos";
import type { ProfileSet } from "@/lib/ai/preference-schema";
import { getArtifactModel } from "@/lib/ai/providers";
import { saveDocument } from "@/lib/db/queries";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

type GenerateProfilesProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  chatId: string;
};

export const generateProfiles = ({
  session,
  dataStream,
  chatId,
}: GenerateProfilesProps) =>
  tool({
    description:
      "Generate 3 romantic partner profiles based on gathered preferences. Only call this after a multi-turn conversation where you have collected meaningful preference information from the user (relationship goal, plus at least a few other preferences like age range, gender, location, or lifestyle). Do NOT call this on the first message or before gathering preferences.",
    inputSchema: z.object({
      preferences: z.object({
        // Core demographics
        ageRange: z
          .object({ min: z.number(), max: z.number() })
          .optional()
          .describe("Preferred age range for a partner"),
        genderPreference: z
          .string()
          .optional()
          .describe("Gender(s) the user is open to dating"),
        location: z
          .string()
          .optional()
          .describe("User's location (city, state)"),
        maxDistanceMiles: z
          .number()
          .optional()
          .describe("Max distance in miles the user is willing to travel"),
        heightPreference: z
          .string()
          .optional()
          .describe("Height preference, e.g. 'at least 5ft 8in' or 'no preference'"),
        ethnicityPreference: z
          .string()
          .optional()
          .describe("Ethnicity preference or 'open to all'"),

        // Relationship goal
        relationshipGoal: z
          .enum(["casual", "serious", "marriage", "friendship", "open", "exploring"])
          .optional()
          .describe("What kind of relationship the user is seeking"),

        // Lifestyle & values
        religionPreference: z
          .string()
          .optional()
          .describe("Religion/faith preference or 'no preference'"),
        smokingPreference: z
          .enum(["dealbreaker", "ok", "prefer_non_smoker"])
          .optional()
          .describe("How the user feels about a partner who smokes"),
        drinkingPreference: z
          .enum(["dealbreaker", "ok", "social_ok"])
          .optional()
          .describe("How the user feels about a partner who drinks"),
        educationPreference: z
          .string()
          .optional()
          .describe("Education level preference, e.g. 'college degree preferred' or 'no preference'"),
        politicalViewsPreference: z
          .string()
          .optional()
          .describe("Political views preference, e.g. 'must be liberal', 'conservative', or 'no preference'"),

        // Optional extras (volunteered by user)
        wantsChildren: z
          .enum(["yes", "no", "open"])
          .optional(),
        okWithPartnersKids: z
          .boolean()
          .optional(),
        personalityTraits: z
          .array(z.string())
          .optional()
          .default([])
          .describe("Personality traits the user values in a partner"),
        coreValues: z
          .array(z.string())
          .optional()
          .default([])
          .describe("Core values the user wants in a partner"),
        dealbreakers: z
          .array(z.string())
          .optional()
          .default([])
          .describe("Absolute dealbreakers"),
        hardConstraints: z
          .array(z.string())
          .optional()
          .default([])
          .describe("Non-negotiable requirements"),
        otherNotes: z
          .string()
          .optional()
          .describe("Any other preference notes"),
      }),
    }),
    execute: async ({ preferences }) => {
      const id = generateUUID();

      // Signal artifact panel to open with profiles kind
      dataStream.write({ type: "data-kind", data: "profiles", transient: true });
      dataStream.write({ type: "data-id", data: id, transient: true });
      dataStream.write({
        type: "data-title",
        data: "Your Matches",
        transient: true,
      });
      dataStream.write({ type: "data-clear", data: null, transient: true });

      const prompt = buildProfileGenerationPrompt(preferences);

      let profilesJson = "";

      const stripMarkdownJsonFence = (input: string) =>
        input
          .trim()
          .replace(/^```(?:json)?\n?/i, "")
          .replace(/\n?```$/i, "");

      try {
        const { text } = await generateText({
          model: getArtifactModel(),
          system: profileGenerationSystemPrompt,
          prompt,
        });

        const cleaned = stripMarkdownJsonFence(text);

        try {
          const parsed = JSON.parse(cleaned) as ProfileSet;

          if (Array.isArray(parsed.profiles) && parsed.profiles.length > 0) {
            const enrichedProfiles = await Promise.all(
              parsed.profiles.map(async (profile) => {
                const profilePhotoDataUrl = await generateProfilePhotoDataUrl(profile);

                if (!profilePhotoDataUrl) {
                  return profile;
                }

                return {
                  ...profile,
                  profilePhotoDataUrl,
                };
              })
            );

            profilesJson = JSON.stringify(
              {
                ...parsed,
                profiles: enrichedProfiles,
              },
              null,
              2
            );
          } else {
            profilesJson = cleaned;
          }
        } catch {
          profilesJson = cleaned;
        }

        // Stream the generated JSON to the artifact
        dataStream.write({
          type: "data-textDelta",
          data: profilesJson,
          transient: true,
        });
      } catch (err) {
        console.error("Profile generation failed:", err);
        // Write an error placeholder so the artifact doesn't hang
        dataStream.write({
          type: "data-textDelta",
          data: JSON.stringify({
            error: "Profile generation failed. Please try again.",
            profiles: [],
            preferencesSummary: "",
            generatedAt: new Date().toISOString(),
          }),
          transient: true,
        });
      } finally {
        // Always close the artifact stream to prevent the UI from getting stuck
        dataStream.write({ type: "data-finish", data: null, transient: true });
      }

      // Persist document to DB if user is authenticated and we have content
      if (session?.user?.id && profilesJson) {
        await saveDocument({
          id,
          title: "Your Matches",
          content: profilesJson,
          kind: "profiles",
          userId: session.user.id,
          chatId,
        });
      }

      return {
        documentId: id,
        message:
          "I've generated 3 partner profiles based on your preferences. You can see them in the panel on the right. Click 👍 or 👎 on any profile to refine your matches, or tell me what you'd like to adjust.",
      };
    },
  });
