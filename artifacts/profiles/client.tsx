"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { Artifact } from "@/components/create-artifact";
import { DocumentSkeleton } from "@/components/document-skeleton";
import type { PartnerProfile, ProfileSet } from "@/lib/ai/preference-schema";
import type { ChatMessage } from "@/lib/types";

type ProfilesMetadata = Record<string, never>;

const profileTypeConfig = {
  close_match: {
    label: "Close Match",
    emoji: "💚",
    badgeClass:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  },
  moderate_stretch: {
    label: "Moderate Stretch",
    emoji: "💛",
    badgeClass:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  },
  exploratory: {
    label: "Exploratory",
    emoji: "💙",
    badgeClass:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  },
};

function ProfileCard({
  profile,
  onLike,
  onDislike,
}: {
  profile: PartnerProfile;
  onLike: (profile: PartnerProfile) => void;
  onDislike: (profile: PartnerProfile) => void;
}) {
  const config = profileTypeConfig[profile.type];

  return (
    <div className="mb-6 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between rounded-t-2xl border-b border-zinc-100 bg-zinc-50 px-5 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${config.badgeClass}`}
        >
          {config.emoji} {config.label}
        </span>
        <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Score:{" "}
          <span className="font-bold text-zinc-900 dark:text-zinc-100">
            {profile.compatibilityScore}%
          </span>
        </span>
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        {/* Identity */}
        <div className="mb-3">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {profile.name}, {profile.age}
            {profile.height ? (
              <span className="ml-2 text-sm font-normal text-zinc-500 dark:text-zinc-400">
                · {profile.height}
              </span>
            ) : null}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {profile.location} &middot; {profile.occupation}
          </p>
        </div>

        {/* Demographic details row */}
        {(profile.ethnicity || profile.religion || profile.education || profile.politicalViews) && (
          <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
            {profile.ethnicity && (
              <span>{profile.ethnicity}</span>
            )}
            {profile.religion && (
              <span>{profile.religion}</span>
            )}
            {profile.education && (
              <span>{profile.education}</span>
            )}
            {profile.politicalViews && (
              <span>{profile.politicalViews}</span>
            )}
          </div>
        )}

        {/* Bio */}
        <blockquote className="mb-4 border-l-2 border-zinc-300 pl-3 text-sm leading-relaxed text-zinc-700 italic dark:border-zinc-600 dark:text-zinc-300">
          &ldquo;{profile.bio}&rdquo;
        </blockquote>

        {/* Traits */}
        <div className="mb-4 flex flex-wrap gap-2">
          {profile.traits.map((trait) => (
            <span
              key={trait}
              className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {trait}
            </span>
          ))}
        </div>

        {/* Compatibility */}
        <div className="mb-4 space-y-2 text-sm">
          <div>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              Why you&apos;d click:{" "}
            </span>
            <span className="text-zinc-600 dark:text-zinc-400">
              {profile.compatibilityNotes}
            </span>
          </div>
          <div>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              Growth point:{" "}
            </span>
            <span className="text-zinc-500 dark:text-zinc-500">
              {profile.challengePoint}
            </span>
          </div>
        </div>

        {/* Feedback Buttons */}
        <div className="flex justify-end gap-2">
          <button
            className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-red-700 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            type="button"
            onClick={() => onDislike(profile)}
          >
            👎 Not for me
          </button>
          <button
            className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:border-green-300 hover:bg-green-50 hover:text-green-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-green-700 dark:hover:bg-green-900/20 dark:hover:text-green-400"
            type="button"
            onClick={() => onLike(profile)}
          >
            👍 This is promising
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfilesContent({
  content,
  isLoading,
  status,
  sendMessage,
}: {
  content: string;
  isLoading: boolean;
  status: "streaming" | "idle";
  sendMessage?: UseChatHelpers<ChatMessage>["sendMessage"];
}) {
  if (isLoading || (status === "streaming" && !content)) {
    return (
      <div className="p-6">
        <DocumentSkeleton artifactKind="text" />
      </div>
    );
  }

  if (status === "streaming") {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <div className="mb-3 text-4xl">💘</div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Crafting your matches...
          </p>
        </div>
      </div>
    );
  }

  let profileSet: ProfileSet | null = null;
  try {
    // Strip potential markdown code block wrapping from LLM output
    const cleaned = content
      .trim()
      .replace(/^```(?:json)?\n?/i, "")
      .replace(/\n?```$/i, "");
    profileSet = JSON.parse(cleaned);
  } catch {
    return (
      <div className="p-6 text-sm text-zinc-500 dark:text-zinc-400">
        Unable to display profiles. Please try regenerating.
      </div>
    );
  }

  if (!profileSet || !profileSet.profiles?.length) {
    return (
      <div className="p-6 text-sm text-zinc-500 dark:text-zinc-400">
        No profiles generated yet.
      </div>
    );
  }

  const handleLike = (profile: PartnerProfile) => {
    if (!sendMessage) return;
    sendMessage({
      role: "user",
      parts: [
        {
          type: "text",
          text: `I liked ${profile.name}'s profile (${profile.type.replace("_", " ")}). Their traits that stood out to me: ${profile.traits.slice(0, 3).join(", ")}. Please regenerate all three profiles with more matches like this one.`,
        },
      ],
    });
  };

  const handleDislike = (profile: PartnerProfile) => {
    if (!sendMessage) return;
    sendMessage({
      role: "user",
      parts: [
        {
          type: "text",
          text: `I didn't connect with ${profile.name}'s profile (${profile.type.replace("_", " ")}). Please regenerate all three profiles and avoid the qualities that made this one feel off.`,
        },
      ],
    });
  };

  return (
    <div className="px-4 py-6 md:px-8">
      {profileSet.preferencesSummary && (
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          {profileSet.preferencesSummary}
        </p>
      )}
      {profileSet.profiles.map((profile) => (
        <ProfileCard
          key={profile.id}
          onDislike={handleDislike}
          onLike={handleLike}
          profile={profile}
        />
      ))}
    </div>
  );
}

export const profilesArtifact = new Artifact<"profiles", ProfilesMetadata>({
  kind: "profiles",
  description: "Displays generated romantic partner profiles with feedback.",

  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === "data-textDelta") {
      setArtifact((draft) => ({
        ...draft,
        content: draft.content + streamPart.data,
        status: "streaming",
        isVisible: true,
      }));
    }
  },

  content: ({
    content,
    isLoading,
    status,
    sendMessage,
  }) => {
    return (
      <ProfilesContent
        content={content}
        isLoading={isLoading}
        sendMessage={sendMessage}
        status={status}
      />
    );
  },

  actions: [],
  toolbar: [
    {
      icon: <span className="text-base">🔄</span>,
      description: "Find new matches",
      onClick: ({ sendMessage }) => {
        sendMessage({
          role: "user",
          parts: [
            {
              type: "text",
              text: "Please regenerate my matches. I'd like to see different profiles based on everything we've discussed.",
            },
          ],
        });
      },
    },
  ],
});
