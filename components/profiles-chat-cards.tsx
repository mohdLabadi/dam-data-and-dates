"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { PartnerProfile, ProfileSet } from "@/lib/ai/preference-schema";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

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

  window.localStorage.setItem(
    SAVED_MATCHES_STORAGE_KEY,
    JSON.stringify(matches),
  );
}

function isAntiMatchType(rawType: string | undefined) {
  const normalized = (rawType ?? "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");

  return normalized === "anti_match" || normalized.includes("anti");
}

function ProfileCard({
  profile,
  onSave,
  onRemove,
  isSaved,
  isSaving,
  isRemoving,
  onLike,
  onDislike,
}: {
  profile: PartnerProfile;
  onSave?: (profile: PartnerProfile) => void;
  onRemove?: () => void;
  isSaved?: boolean;
  isSaving?: boolean;
  isRemoving?: boolean;
  onLike: (profile: PartnerProfile) => void;
  onDislike: (profile: PartnerProfile) => void;
}) {
  const initials = profile.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mx-auto mb-6 w-full max-w-4xl overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:border-zinc-700 dark:bg-zinc-900">
      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr]">
        <div className="relative h-48 w-full bg-zinc-100 sm:h-56 md:h-full dark:bg-zinc-800">
          {profile.profilePhotoDataUrl ? (
            <Image
              alt={`${profile.name} profile photo`}
              className="h-full w-full object-cover"
              fill={true}
              sizes="(max-width: 768px) 100vw, 320px"
              src={profile.profilePhotoDataUrl}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-rose-200 to-amber-100 text-5xl font-semibold text-zinc-700 dark:from-zinc-700 dark:to-zinc-800 dark:text-zinc-100">
              {initials}
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-4 text-white md:hidden">
            <h3 className="text-xl font-semibold tracking-tight">
              {profile.name}, {profile.age}
            </h3>
            <p className="mt-1 text-xs text-white/90 sm:text-sm">
              {profile.location} · {profile.occupation}
            </p>
            {profile.height ? (
              <p className="mt-1 text-xs uppercase tracking-wide text-white/70">
                {profile.height}
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-3 px-4 py-4 sm:px-5 sm:py-5">
          <div className="hidden md:block">
            <h3 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {profile.name}, {profile.age}
            </h3>
            <p className="mt-1 text-xs text-zinc-500 sm:text-sm dark:text-zinc-400">
              {profile.location} · {profile.occupation}
            </p>
            {profile.height ? (
              <p className="mt-1 text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                {profile.height}
              </p>
            ) : null}
          </div>

          {(profile.ethnicity ||
            profile.religion ||
            profile.education ||
            profile.politicalViews) && (
            <div className="flex flex-wrap gap-1.5 text-xs">
              {profile.ethnicity && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {profile.ethnicity}
                </span>
              )}
              {profile.religion && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {profile.religion}
                </span>
              )}
              {profile.education && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {profile.education}
                </span>
              )}
              {profile.politicalViews && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {profile.politicalViews}
                </span>
              )}
            </div>
          )}

          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {profile.bio}
          </p>

          <div className="flex flex-wrap gap-1.5">
            {profile.traits.map((trait) => (
              <span
                key={trait}
                className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                {trait}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-zinc-100 pt-1 md:border-t dark:border-zinc-800">
            {onSave ? (
              <button
                className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-amber-700 dark:hover:bg-amber-900/20 dark:hover:text-amber-300"
                disabled={Boolean(isSaved) || Boolean(isSaving)}
                onClick={() => onSave(profile)}
                type="button"
              >
                {isSaved ? "⭐ Saved" : isSaving ? "Saving..." : "⭐ Save match"}
              </button>
            ) : null}

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
                  className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:border-green-300 hover:bg-green-50 hover:text-green-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-green-700 dark:hover:bg-green-900/20 dark:hover:text-green-400"
                  onClick={() => onLike(profile)}
                  type="button"
                >
                  👍 This is promising
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProfilesChatCards({
  profileSet,
  documentId,
  sendMessage,
}: {
  profileSet: ProfileSet;
  documentId?: string;
  sendMessage?: UseChatHelpers<ChatMessage>["sendMessage"];
}) {
  const [activeTab, setActiveTab] = useState<"current" | "saved">("current");
  const [savedMatches, setSavedMatches] = useState<SavedMatchRecord[]>([]);
  const [isSavedLoading, setIsSavedLoading] = useState(true);
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null);
  const [removingMatchId, setRemovingMatchId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [savedIndex, setSavedIndex] = useState(0);
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);
  const [swipeOffsetX, setSwipeOffsetX] = useState(0);
  const [isSwipeDragging, setIsSwipeDragging] = useState(false);
  const activePointerIdRef = useRef<number | null>(null);

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

  useEffect(() => {
    if (profileSet.profiles.length === 0) {
      setCurrentIndex(0);
      return;
    }

    setCurrentIndex((index) => Math.min(index, profileSet.profiles.length - 1));
  }, [profileSet.profiles.length]);

  useEffect(() => {
    if (savedMatches.length === 0) {
      setSavedIndex(0);
      return;
    }

    setSavedIndex((index) => Math.min(index, savedMatches.length - 1));
  }, [savedMatches.length]);

  const handleSaveMatch = async (profile: PartnerProfile) => {
    if (!documentId) {
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
          documentId,
          profile,
        }),
      });

      let saved: SavedMatchRecord;

      if (!response.ok) {
        saved = {
          id: generateUUID(),
          createdAt: new Date().toISOString(),
          userId: "local",
          documentId,
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

  const handleLike = (profile: PartnerProfile) => {
    if (!sendMessage) return;

    const docInstruction = documentId
      ? ` Use updateDocument with id ${documentId}.`
      : "";

    sendMessage({
      role: "user",
      parts: [
        {
          type: "text",
          text: `I liked ${profile.name}'s profile (${profile.type.replace("_", " ")}). Their traits that stood out to me: ${profile.traits.slice(0, 3).join(", ")}. Please regenerate all four profiles with more matches like this one.${docInstruction}`,
        },
      ],
    });
  };

  const handleDislike = (profile: PartnerProfile) => {
    if (!sendMessage) return;

    const docInstruction = documentId
      ? ` Use updateDocument with id ${documentId}.`
      : "";

    sendMessage({
      role: "user",
      parts: [
        {
          type: "text",
          text: `I didn't connect with ${profile.name}'s profile (${profile.type.replace("_", " ")}). Please regenerate all four profiles and avoid the qualities that made this one feel off.${docInstruction}`,
        },
      ],
    });
  };

  const resetSwipe = () => {
    setSwipeStartX(null);
    setSwipeOffsetX(0);
    setIsSwipeDragging(false);
  };

  const handleSwipeStart = (x: number) => {
    if (activeTab !== "current") {
      return;
    }

    setSwipeStartX(x);
    setIsSwipeDragging(true);
  };

  const handleSwipeMove = (x: number) => {
    if (swipeStartX === null || activeTab !== "current") {
      return;
    }

    const delta = x - swipeStartX;
    const clamped = Math.max(-140, Math.min(140, delta));
    setSwipeOffsetX(clamped);
  };

  const handleSwipeEnd = () => {
    if (activeTab !== "current") {
      resetSwipe();
      return;
    }

    const activeProfile = profileSet.profiles[currentIndex];

    if (!activeProfile) {
      resetSwipe();
      return;
    }

    const threshold = 90;

    if (swipeOffsetX >= threshold) {
      handleLike(activeProfile);
    } else if (swipeOffsetX <= -threshold) {
      handleDislike(activeProfile);
    }

    resetSwipe();
  };

  const isInteractiveElement = (target: EventTarget | null) => {
    if (!(target instanceof Element)) {
      return false;
    }

    return Boolean(target.closest("button,a,input,textarea,select"));
  };

  return (
    <div className="w-full rounded-xl border border-border bg-background p-4">
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
            <>
              <div className="mb-3 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                <span>
                  Saved profile {savedIndex + 1} of {savedMatches.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-full border border-zinc-200 px-2.5 py-1 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    disabled={savedIndex === 0}
                    onClick={() => setSavedIndex((index) => Math.max(0, index - 1))}
                    type="button"
                  >
                    Prev
                  </button>
                  <button
                    className="rounded-full border border-zinc-200 px-2.5 py-1 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    disabled={savedIndex >= savedMatches.length - 1}
                    onClick={() =>
                      setSavedIndex((index) =>
                        Math.min(savedMatches.length - 1, index + 1),
                      )
                    }
                    type="button"
                  >
                    Next
                  </button>
                </div>
              </div>

              <ProfileCard
                key={savedMatches[savedIndex].id}
                isRemoving={removingMatchId === savedMatches[savedIndex].id}
                onDislike={() => {}}
                onLike={() => {}}
                onRemove={() => handleRemoveSavedMatch(savedMatches[savedIndex].id)}
                profile={savedMatches[savedIndex].profile}
              />
            </>
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
          {profileSet.profiles.length > 0 && (
            <>
              <div className="mb-3 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                <span>
                  Match {currentIndex + 1} of {profileSet.profiles.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-full border border-zinc-200 px-2.5 py-1 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
                    type="button"
                  >
                    Prev
                  </button>
                  <button
                    className="rounded-full border border-zinc-200 px-2.5 py-1 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    disabled={currentIndex >= profileSet.profiles.length - 1}
                    onClick={() =>
                      setCurrentIndex((index) =>
                        Math.min(profileSet.profiles.length - 1, index + 1),
                      )
                    }
                    type="button"
                  >
                    Next
                  </button>
                </div>
              </div>

              <div
                className="relative"
                onPointerCancel={handleSwipeEnd}
                onPointerDown={(event) => {
                  if (isInteractiveElement(event.target)) {
                    return;
                  }

                  activePointerIdRef.current = event.pointerId;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  handleSwipeStart(event.clientX);
                }}
                onPointerMove={(event) => {
                  if (activePointerIdRef.current !== event.pointerId) {
                    return;
                  }

                  handleSwipeMove(event.clientX);
                }}
                onPointerUp={(event) => {
                  if (activePointerIdRef.current !== event.pointerId) {
                    return;
                  }

                  activePointerIdRef.current = null;
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                  handleSwipeEnd();
                }}
                style={{ touchAction: "pan-y" }}
              >
                <div
                  className={isSwipeDragging ? "transition-none" : "transition-transform duration-200"}
                  style={{
                    transform: `translateX(${swipeOffsetX}px) rotate(${swipeOffsetX / 25}deg)`,
                  }}
                >
                  <ProfileCard
                    isSaved={
                      !isAntiMatchType(profileSet.profiles[currentIndex].type) &&
                      savedProfileKeys.has(
                        `${documentId}:${profileSet.profiles[currentIndex].id}`,
                      )
                    }
                    isSaving={
                      savingProfileId === profileSet.profiles[currentIndex].id
                    }
                    key={profileSet.profiles[currentIndex].id}
                    onDislike={handleDislike}
                    onLike={handleLike}
                    onSave={
                      isAntiMatchType(profileSet.profiles[currentIndex].type)
                        ? undefined
                        : handleSaveMatch
                    }
                    profile={profileSet.profiles[currentIndex]}
                  />
                </div>

                <div
                  className="pointer-events-none absolute top-3 left-3 rounded-full bg-red-600/90 px-2.5 py-1 text-xs font-semibold text-white"
                  style={{ opacity: Math.max(0, -swipeOffsetX / 70) }}
                >
                  👎 Pass
                </div>
                <div
                  className="pointer-events-none absolute top-3 right-3 rounded-full bg-green-600/90 px-2.5 py-1 text-xs font-semibold text-white"
                  style={{ opacity: Math.max(0, swipeOffsetX / 70) }}
                >
                  👍 Like
                </div>
              </div>

              <p className="-mt-2 mb-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
                Swipe left to pass, swipe right to like.
              </p>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
