import { generateText, tool } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import {
  buildProfileGenerationPrompt,
  profileGenerationSystemPrompt,
} from "@/lib/ai/prompts";
import { generateProfilePhotoDataUrl } from "@/lib/ai/profile-photos";
import type {
  PartnerProfile,
  PreferenceState,
  ProfileSet,
} from "@/lib/ai/preference-schema";
import { getArtifactModel } from "@/lib/ai/providers";
import { saveDocument } from "@/lib/db/queries";
import { generateUUID } from "@/lib/utils";

type GenerateProfilesProps = {
  session: Session;
  chatId: string;
};

function buildAntiMatchMismatchSignals(preferences: PreferenceState) {
  const signals: string[] = [];

  if (preferences.ageRange) {
    signals.push("outside preferred age range");
  }
  if (preferences.genderPreference) {
    signals.push("outside stated gender preference");
  }
  if (preferences.location || preferences.maxDistanceMiles) {
    signals.push("outside preferred location/distance");
  }
  if (preferences.heightPreference) {
    signals.push("does not match stated height preference");
  }
  if (preferences.ethnicityPreference) {
    signals.push("does not match stated ethnicity preference");
  }
  if (preferences.religionPreference) {
    signals.push("does not match stated religion preference");
  }
  if (preferences.educationPreference) {
    signals.push("does not match stated education preference");
  }
  if (preferences.politicalViewsPreference) {
    signals.push("conflicts with stated political preference");
  }
  if (preferences.smokingPreference) {
    signals.push("smoking habits conflict with stated preference");
  }
  if (preferences.drinkingPreference) {
    signals.push("drinking habits conflict with stated preference");
  }
  if (preferences.personalityTraits.length > 0) {
    signals.push("personality conflicts with desired traits");
  }
  if (preferences.coreValues.length > 0) {
    signals.push("core values conflict with what user wants");
  }

  return signals;
}

function ensureAntiMatchProfile(
  profiles: PartnerProfile[],
  preferences: PreferenceState
): PartnerProfile[] {
  const trimmedProfiles = profiles.slice(0, 4);

  if (trimmedProfiles.length === 0) {
    return trimmedProfiles;
  }

  const normalizeType = (type: string | undefined) =>
    (type ?? "")
      .toLowerCase()
      .trim()
      .replace(/[\s-]+/g, "_");

  const antiIndexes = trimmedProfiles
    .map((profile, index) => ({
      index,
      normalizedType: normalizeType(profile.type),
    }))
    .filter(({ normalizedType }) => normalizedType === "anti_match")
    .map(({ index }) => index);

  const lowestScoreIndex = trimmedProfiles.reduce((minIndex, current, index, arr) =>
    current.compatibilityScore < arr[minIndex].compatibilityScore ? index : minIndex
  , 0);

  const primaryAntiIndex = antiIndexes[0] ?? lowestScoreIndex;
  const mismatchSignals = buildAntiMatchMismatchSignals(preferences);

  return trimmedProfiles.map((profile, index) => {
    if (index === primaryAntiIndex) {
      const antiNotesPrefix =
        "Intentional anti-match for comparison: this profile conflicts with core preferences.";
      const antiChallengePrefix =
        "Intentional anti-match: multiple stated preferences are not satisfied.";
      const negativeTraitDefaults = ["dismissive", "self-centered", "inconsistent"];
      const existingTraits = Array.isArray(profile.traits) ? profile.traits : [];
      const mergedTraits = Array.from(
        new Set([...existingTraits, ...negativeTraitDefaults])
      ).slice(0, 5);
      const mismatchSummary =
        mismatchSignals.length > 0
          ? ` Key mismatches: ${mismatchSignals.slice(0, 5).join(", ")}.`
          : "";
      const preferredLocation = preferences.location?.trim();
      const oppositeLocation = preferredLocation
        ? `Far from ${preferredLocation}`
        : profile.location;
      const forcedAge = preferences.ageRange
        ? Math.max(preferences.ageRange.max + 7, profile.age)
        : profile.age;

      return {
        ...profile,
        type: "anti_match",
        age: forcedAge,
        location: oppositeLocation,
        compatibilityScore: Math.min(profile.compatibilityScore, 25),
        traits: mergedTraits,
        compatibilityNotes: profile.compatibilityNotes?.includes("Intentional anti-match")
          ? profile.compatibilityNotes
          : `${antiNotesPrefix}${mismatchSummary} ${profile.compatibilityNotes}`,
        challengePoint: profile.challengePoint?.includes("Intentional anti-match")
          ? profile.challengePoint
          : `${antiChallengePrefix}${mismatchSummary} ${profile.challengePoint}`,
      };
    }

    if (antiIndexes.includes(index)) {
      return {
        ...profile,
        type: "exploratory",
      };
    }

    return profile;
  });
}

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
      "Generate 4 romantic partner profiles based on gathered preferences: close_match, moderate_stretch, exploratory, and one explicitly labeled anti_match for comparison. Only call this after a multi-turn conversation where you have collected meaningful preference information from the user (relationship goal, plus at least a few other preferences like age range, gender, location, or lifestyle). Do NOT call this on the first message or before gathering preferences.",
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
            const normalizedProfiles = ensureAntiMatchProfile(
              parsed.profiles,
              preferences
            );
            const enrichedProfiles = await Promise.all(
              normalizedProfiles.map(async (profile) => {
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

      // Persist document to DB if user is authenticated and we have content
      if (session?.user?.id && profilesJson) {
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
          "I've generated 4 partner profiles based on your preferences, including one intentional anti-match for comparison. They're displayed right here in chat. Click 👍 or 👎 on any profile to refine your matches, or tell me what you'd like to adjust.",
      };
    },
  });
