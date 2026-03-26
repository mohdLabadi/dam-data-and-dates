"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Artifact } from "@/components/create-artifact";
import { DocumentSkeleton } from "@/components/document-skeleton";
import type { PartnerProfile, ProfileSet } from "@/lib/ai/preference-schema";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

type ProfilesMetadata = {
  documentId: string;
};

type SavedMatchRecord = {
  id: string;
  createdAt: string;
  userId: string;
  documentId: string;
  profileId: string;
  profile: PartnerProfile;
};

const SAVED_MATCHES_STORAGE_KEY = "dam-saved-matches";

function readSavedMatchesFromLocalStorage() {
  if (typeof window === "undefined") {
    return [] as SavedMatchRecord[];
  }

  try {
    const raw = window.localStorage.getItem(SAVED_MATCHES_STORAGE_KEY);

    if (!raw) {
      return [] as SavedMatchRecord[];
    }

    const parsed = JSON.parse(raw) as SavedMatchRecord[];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as SavedMatchRecord[];
  }
}

function writeSavedMatchesToLocalStorage(matches: SavedMatchRecord[]) {
  if (typeof window === "undefined") {
    return;
  }

  const stripped = matches.map((m) => ({
    ...m,
    profile: { ...m.profile, profilePhotoDataUrl: undefined },
  }));

  try {
    window.localStorage.setItem(
      SAVED_MATCHES_STORAGE_KEY,
      JSON.stringify(stripped),
    );
  } catch {
    // Quota exceeded — skip local persistence; server is the source of truth
  }
}

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

function getProfileTypeConfig(rawType: string | undefined) {
  const normalized = (rawType ?? "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");

  if (normalized === "close_match") {
    return profileTypeConfig.close_match;
  }

  if (normalized === "moderate_stretch") {
    return profileTypeConfig.moderate_stretch;
  }

  return profileTypeConfig.exploratory;
}


function ProfileCard({
  profile,
  onRemove,
  isSaved,
  isSaving,
  isRemoving,
  onLike,
  onDislike,
}: {
  profile: PartnerProfile;
  onRemove?: () => void;
  isSaved?: boolean;
  isSaving?: boolean;
  isRemoving?: boolean;
  onLike: (profile: PartnerProfile) => void;
  onDislike: (profile: PartnerProfile) => void;
}) {
  const config = getProfileTypeConfig(profile.type);

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
        <div className="mb-3 flex items-center gap-3">
          <div className="relative h-14 w-14 overflow-hidden rounded-full border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
            {profile.profilePhotoDataUrl ? (
              <Image
                alt={`${profile.name} profile photo`}
                className="h-full w-full object-cover"
                height={56}
                src={profile.profilePhotoDataUrl}
                width={56}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                {profile.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
            )}
          </div>
          <div>
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
        </div>

        {/* Demographic details row */}
        {(profile.ethnicity ||
          profile.religion ||
          profile.education ||
          profile.politicalViews) && (
          <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
            {profile.ethnicity && <span>{profile.ethnicity}</span>}
            {profile.religion && <span>{profile.religion}</span>}
            {profile.education && <span>{profile.education}</span>}
            {profile.politicalViews && <span>{profile.politicalViews}</span>}
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

        {/* Actions */}
        <div className="flex flex-wrap justify-end gap-2">
          {onRemove ? (
            <button
              className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
              disabled={Boolean(isRemoving)}
              onClick={onRemove}
              type="button"
            >
              {isRemoving ? "Removing..." : "Remove"}
            </button>
          ) : (
            <>
              <button
                className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-red-700 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                onClick={() => onDislike(profile)}
                type="button"
              >
                👎 Not for me
              </button>
              <button
                className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:border-green-300 hover:bg-green-50 hover:text-green-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-green-700 dark:hover:bg-green-900/20 dark:hover:text-green-400"
                disabled={Boolean(isSaved) || Boolean(isSaving)}
                onClick={() => onLike(profile)}
                type="button"
              >
                {isSaved ? "⭐ Saved" : isSaving ? "Saving..." : "👍 Save & find more like this"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfilesContent({
  content,
  isLoading,
  metadata,
  status,
  sendMessage,
}: {
  content: string;
  isLoading: boolean;
  metadata?: ProfilesMetadata | null;
  status: "streaming" | "idle";
  sendMessage?: UseChatHelpers<ChatMessage>["sendMessage"];
}) {
  const [activeTab, setActiveTab] = useState<"current" | "saved">("current");
  const [savedMatches, setSavedMatches] = useState<SavedMatchRecord[]>([]);
  const [isSavedLoading, setIsSavedLoading] = useState(true);
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null);
  const [removingMatchId, setRemovingMatchId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadSavedMatches = async () => {
      const localMatches = readSavedMatchesFromLocalStorage();

      try {
        const response = await fetch("/api/matches");

        if (!response.ok) {
          throw new Error("Failed to fetch saved matches");
        }

        const matches = (await response.json()) as SavedMatchRecord[];

        if (isMounted) {
          if (matches.length > 0) {
            setSavedMatches(matches);
            writeSavedMatchesToLocalStorage(matches);
          } else {
            setSavedMatches(localMatches);
          }
        }
      } catch {
        if (isMounted) {
          setSavedMatches(localMatches);
        }
      } finally {
        if (isMounted) {
          setIsSavedLoading(false);
        }
      }
    };

    loadSavedMatches();

    return () => {
      isMounted = false;
    };
  }, []);

  const savedProfileKeys = useMemo(() => {
    return new Set(
      savedMatches.map((match) => `${match.documentId}:${match.profileId}`),
    );
  }, [savedMatches]);

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

  const handleSaveMatch = async (profile: PartnerProfile) => {
    if (!metadata?.documentId) {
      toast.error("Could not save match: missing profile set ID.");
      return;
    }

    try {
      setSavingProfileId(profile.id);

      const response = await fetch("/api/matches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId: metadata.documentId,
          profile,
        }),
      });

      let saved: SavedMatchRecord;

      if (!response.ok) {
        saved = {
          id: generateUUID(),
          createdAt: new Date().toISOString(),
          userId: "local",
          documentId: metadata.documentId,
          profileId: profile.id,
          profile,
        };
      } else {
        saved = (await response.json()) as SavedMatchRecord;
      }

      setSavedMatches((current) => {
        const alreadySaved = current.some(
          (item) =>
            item.documentId === saved.documentId &&
            item.profileId === saved.profileId,
        );

        if (alreadySaved) {
          return current;
        }

        const next = [saved, ...current];
        writeSavedMatchesToLocalStorage(next);
        return next;
      });

      toast.success(`${profile.name} saved to your matches.`);
    } catch {
      toast.error("Unable to save this match right now.");
    } finally {
      setSavingProfileId(null);
    }
  };

  const handleRemoveSavedMatch = async (matchId: string) => {
    try {
      setRemovingMatchId(matchId);

      const response = await fetch(`/api/matches?id=${matchId}`, {
        method: "DELETE",
      });

      setSavedMatches((current) => {
        const next = current.filter((match) => match.id !== matchId);
        writeSavedMatchesToLocalStorage(next);
        return next;
      });

      if (!response.ok) {
        // localStorage fallback already applied above
      }

      toast.success("Match removed from saved list.");
    } catch {
      // If request itself failed (offline/no route), still remove locally.
      setSavedMatches((current) => {
        const next = current.filter((match) => match.id !== matchId);
        writeSavedMatchesToLocalStorage(next);
        return next;
      });
      toast.success("Match removed from saved list.");
    } finally {
      setRemovingMatchId(null);
    }
  };

  const handleLike = async (profile: PartnerProfile) => {
    if (!sendMessage) return;

    await handleSaveMatch(profile);

    sendMessage({
      role: "user",
      parts: [
        {
          type: "text",
          text: `I liked ${profile.name}'s profile (${profile.type.replace("_", " ")}). Their traits that stood out to me: ${profile.traits.slice(0, 3).join(", ")}. Please regenerate all four profiles with more matches like this one.`,
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
          text: `I didn't connect with ${profile.name}'s profile (${profile.type.replace("_", " ")}). Please regenerate all four profiles and avoid the qualities that made this one feel off.`,
        },
      ],
    });
  };

  return (
    <div className="px-4 py-6 md:px-8">
      <div className="mb-5 flex items-center gap-2">
        <button
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            activeTab === "current"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          }`}
          onClick={() => setActiveTab("current")}
          type="button"
        >
          Current Matches
        </button>
        <button
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            activeTab === "saved"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          }`}
          onClick={() => setActiveTab("saved")}
          type="button"
        >
          Saved ({savedMatches.length})
        </button>
      </div>

      {activeTab === "saved" ? (
        <div>
          {isSavedLoading ? (
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              Loading saved matches...
            </div>
          ) : savedMatches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              You haven&apos;t saved any matches yet. Click "Save match" on a
              profile to keep it here.
            </div>
          ) : (
            savedMatches.map((savedMatch) => (
              <ProfileCard
                key={savedMatch.id}
                isRemoving={removingMatchId === savedMatch.id}
                onDislike={() => {}}
                onLike={() => {}}
                onRemove={() => handleRemoveSavedMatch(savedMatch.id)}
                profile={savedMatch.profile}
              />
            ))
          )}
        </div>
      ) : null}

      {activeTab === "current" ? (
        <>
          {profileSet.preferencesSummary && (
            <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
              {profileSet.preferencesSummary}
            </p>
          )}
          {profileSet.profiles.map((profile) => (
            <ProfileCard
              isSaved={
                savedProfileKeys.has(`${metadata?.documentId}:${profile.id}`)
              }
              isSaving={savingProfileId === profile.id}
              key={profile.id}
              onDislike={handleDislike}
              onLike={handleLike}
              profile={profile}
            />
          ))}
        </>
      ) : null}
    </div>
  );
}

export const profilesArtifact = new Artifact<"profiles", ProfilesMetadata>({
  kind: "profiles",
  description: "Displays generated romantic partner profiles with feedback.",
  initialize: ({ documentId, setMetadata }) => {
    setMetadata({ documentId });
  },

  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === "data-textDelta") {
      setArtifact((draft) => ({
        ...draft,
        content: draft.content + streamPart.data,
        status: "streaming",
      }));
    }
  },

  content: ({ content, isLoading, metadata, status, sendMessage }) => {
    return (
      <ProfilesContent
        content={content}
        isLoading={isLoading}
        metadata={metadata}
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
