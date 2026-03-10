"use client";

import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import type { PartnerProfile } from "@/lib/ai/preference-schema";
import type { SavedMatch } from "@/lib/db/schema";

const profileTypeConfig: Record<
  string,
  { label: string; emoji: string; badgeClass: string }
> = {
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

function getTypeConfig(type: string) {
  const key = type.toLowerCase().replace(/[\s-]+/g, "_");
  return (
    profileTypeConfig[key] ?? {
      label: type,
      emoji: "💜",
      badgeClass:
        "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    }
  );
}

function SavedMatchCard({
  match,
  onRemove,
  isRemoving,
}: {
  match: SavedMatch;
  onRemove: (id: string) => void;
  isRemoving: boolean;
}) {
  const profile = match.profile as PartnerProfile;
  const config = getTypeConfig(profile.type ?? "");

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
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

      <div className="px-5 py-4">
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
                  .map((p) => p[0])
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

        <blockquote className="mb-4 border-l-2 border-zinc-300 pl-3 text-sm leading-relaxed text-zinc-700 italic dark:border-zinc-600 dark:text-zinc-300">
          &ldquo;{profile.bio}&rdquo;
        </blockquote>

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

        <div className="mb-4 space-y-2 text-sm">
          <div>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              Why you&apos;d click:{" "}
            </span>
            <span className="text-zinc-600 dark:text-zinc-400">
              {profile.compatibilityNotes}
            </span>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-red-700 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            disabled={isRemoving}
            onClick={() => onRemove(match.id)}
            type="button"
          >
            {isRemoving ? "Removing..." : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SavedMatchesPage({
  initialMatches,
}: {
  initialMatches: SavedMatch[];
}) {
  const [matches, setMatches] = useState<SavedMatch[]>(initialMatches);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    try {
      const res = await fetch(`/api/matches?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setMatches((current) => current.filter((m) => m.id !== id));
      toast.success("Match removed.");
    } catch {
      toast.error("Failed to remove match.");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        Saved Matches
      </h1>
      <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">
        All the profiles you&apos;ve saved across your conversations.
      </p>

      {matches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          You haven&apos;t saved any matches yet. Start a conversation and click
          &ldquo;Save match&rdquo; on a profile.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {matches.map((match) => (
            <SavedMatchCard
              isRemoving={removingId === match.id}
              key={match.id}
              match={match}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
