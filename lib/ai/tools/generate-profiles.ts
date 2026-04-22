import { generateText, tool } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { sanitizeCompatibilityText } from "@/lib/ai/content-guardrails";
import {
  buildProfileGenerationPrompt,
  profileGenerationSystemPrompt,
} from "@/lib/ai/prompts";
import { generateProfilePhotoDataUrl } from "@/lib/ai/profile-photos";
import type {
  PartnerProfile,
  ProfileSet,
} from "@/lib/ai/preference-schema";
import { getArtifactModel } from "@/lib/ai/providers";
import { saveDocument } from "@/lib/db/queries";
import { generateUUID } from "@/lib/utils";

type GenerateProfilesProps = {
  session: Session;
  chatId: string;
};


function parseProfileSetFromJson(input: string): ProfileSet | null {
  try {
    const parsed = JSON.parse(input) as Partial<ProfileSet>;

    if (!Array.isArray(parsed.profiles)) {
      return null;
    }

    return {
      profiles: parsed.profiles as PartnerProfile[],
      generatedAt:
        typeof parsed.generatedAt === "string"
          ? parsed.generatedAt
          : new Date().toISOString(),
      preferencesSummary:
        typeof parsed.preferencesSummary === "string"
          ? parsed.preferencesSummary
          : "",
    };
  } catch {
    return null;
  }
}

export const generateProfiles = ({
  session,
  chatId,
}: GenerateProfilesProps) =>
  tool({
    description:
      "Generate 4 romantic partner profiles based on gathered preferences: one close_match, one moderate_stretch, and two exploratory profiles. Only call this after a multi-turn conversation where you have collected meaningful preference information from the user (relationship goal, plus at least a few other preferences like age range, gender, location, or lifestyle). Do NOT call this on the first message or before gathering preferences.",
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
          .enum([
            "dating",
            "casual",
            "serious",
            "marriage",
            "friendship",
            "collaboration",
            "networking",
            "employee",
            "open",
            "exploring",
          ])
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
          .enum(["dealbreaker", "ok", "social_ok", "no_drinking"])
          .optional()
          .describe("How the user feels about a partner who drinks. Use 'no_drinking' when the user explicitly wants a non-drinker partner. Use 'ok' when the user says they are 'open', have no preference, or are fine with any level of drinking. Use 'social_ok' for social or occasional drinking only. Use 'dealbreaker' if heavy drinking is unacceptable."),
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
          .describe("Qualities and traits the user wants in a partner (e.g. kind, emotionally available, ambitious)"),
        coreValues: z
          .array(z.string())
          .optional()
          .default([])
          .describe("The user's own fundamental values — what matters most to them personally (e.g. family-oriented, growth mindset). Use these to find a partner who shares or respects those values."),
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
      let profileSet: ProfileSet | null = null;

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
            const PHOTO_TIMEOUT_MS = 12_000;
            const enrichedProfiles = await Promise.all(
              parsed.profiles.slice(0, 4).map(async (profile: PartnerProfile) => {
                const profilePhotoDataUrl = await Promise.race([
                  generateProfilePhotoDataUrl(profile),
                  new Promise<null>((resolve) =>
                    setTimeout(() => resolve(null), PHOTO_TIMEOUT_MS)
                  ),
                ]);

                if (!profilePhotoDataUrl) {
                  return profile;
                }

                return {
                  ...profile,
                  profilePhotoDataUrl,
                };
              })
            );

            const sanitizedProfiles = enrichedProfiles.map((profile) => ({
              ...profile,
              compatibilityNotes: sanitizeCompatibilityText(
                profile.compatibilityNotes ?? "",
                "This pairing brings together complementary values and genuine potential for connection."
              ),
              challengePoint: sanitizeCompatibilityText(
                profile.challengePoint ?? "",
                "They bring a different perspective that could lead to interesting conversations and growth."
              ),
            }));

            profilesJson = JSON.stringify(
              {
                ...parsed,
                profiles: sanitizedProfiles,
              },
              null,
              2
            );
            profileSet = parseProfileSetFromJson(profilesJson);
          } else {
            profilesJson = cleaned;
            profileSet = parseProfileSetFromJson(cleaned);
          }
        } catch {
          profilesJson = cleaned;
          profileSet = parseProfileSetFromJson(cleaned);
        }

      } catch (err) {
        console.error("Profile generation failed:", err);
        profilesJson = JSON.stringify({
          error: "Profile generation failed. Please try again.",
          profiles: [],
          preferencesSummary: "",
          generatedAt: new Date().toISOString(),
        });
      }

      // Persist document to DB if DB is configured
      if (process.env.POSTGRES_URL && session?.user?.id && profilesJson) {
        try {
          await saveDocument({
            id,
            title: "Your Matches",
            content: profilesJson,
            kind: "profiles",
            userId: session.user.id,
            chatId,
          });
        } catch (dbErr) {
          console.error("Failed to persist profiles to DB:", dbErr);
        }
      }

      return {
        documentId: id,
        profileSet,
        profiles: profileSet?.profiles,
        preferencesSummary: profileSet?.preferencesSummary,
        message:
          "I've generated 4 partner profiles based on your preferences. They're displayed right here in chat. Click 👍 or 👎 on any profile to refine your matches, or tell me what you'd like to adjust.",
      };
    },
  });
