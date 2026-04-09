"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { PartnerProfile, ProfileSet } from "@/lib/ai/preference-schema";
import {
  clearSessionLocalStorage,
  SAVED_MATCHES_STORAGE_KEY,
} from "@/lib/session-storage";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

type SwipeDecision = "like" | "pass";

type SavedMatchRecord = {
  id: string;
  createdAt: string;
  userId: string;
  documentId: string;
  profileId: string;
  profile: PartnerProfile;
};

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

  try {
    window.localStorage.setItem(
      SAVED_MATCHES_STORAGE_KEY,
      JSON.stringify(matches),
    );
  } catch {
    // Quota exceeded — retry without photo data
    try {
      const stripped = matches.map((m) => ({
        ...m,
        profile: { ...m.profile, profilePhotoDataUrl: undefined },
      }));
      window.localStorage.setItem(
        SAVED_MATCHES_STORAGE_KEY,
        JSON.stringify(stripped),
      );
    } catch {
      // Still too large — skip local persistence; server is the source of truth
    }
  }
}

export function ProfileCard({
  profile,
  onSave,
  onRemove,
  onChooseMatch,
  isSaved,
  isSaving,
  isRemoving,
  saveLocked,
}: {
  profile: PartnerProfile;
  onSave?: (profile: PartnerProfile) => void;
  onRemove?: () => void;
  onChooseMatch?: (profile: PartnerProfile) => void;
  isSaved?: boolean;
  isSaving?: boolean;
  isRemoving?: boolean;
  saveLocked?: boolean;
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
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xl font-semibold tracking-tight">
                {profile.name}, {profile.age}
              </h3>
              {onSave ? (
                <button
                  className="rounded-full border border-white/50 bg-black/30 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={Boolean(isSaved) || Boolean(isSaving) || saveLocked}
                  onClick={() => onSave(profile)}
                  type="button"
                >
                  {saveLocked
                    ? "Swipe all first"
                    : isSaved
                      ? "Saved"
                      : isSaving
                        ? "Saving..."
                        : "Save"}
                </button>
              ) : null}
            </div>
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
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                {profile.name}, {profile.age}
              </h3>
              {onSave ? (
                <button
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition-colors hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-amber-700 dark:hover:bg-amber-900/20 dark:hover:text-amber-300"
                  disabled={Boolean(isSaved) || Boolean(isSaving) || saveLocked}
                  onClick={() => onSave(profile)}
                  type="button"
                >
                  {saveLocked
                    ? "Swipe all first"
                    : isSaved
                      ? "⭐ Saved"
                      : isSaving
                        ? "Saving..."
                        : "⭐ Save"}
                </button>
              ) : null}
            </div>
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
            {onChooseMatch ? (
              <button
                className="flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-800 transition-colors hover:border-emerald-400 hover:bg-emerald-100 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60"
                onClick={() => onChooseMatch(profile)}
                type="button"
              >
                This is the one for me
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
            ) : null}
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
  const router = useRouter();
  const [savedMatches, setSavedMatches] = useState<SavedMatchRecord[]>([]);
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);
  const [swipeOffsetX, setSwipeOffsetX] = useState(0);
  const [isSwipeDragging, setIsSwipeDragging] = useState(false);
  const [swipeDecisions, setSwipeDecisions] = useState<
    Record<string, SwipeDecision>
  >({});
  const [hasSubmittedSwipeSummary, setHasSubmittedSwipeSummary] =
    useState(false);
  const [matchedProfile, setMatchedProfile] = useState<PartnerProfile | null>(
    null,
  );
  const activePointerIdRef = useRef<number | null>(null);
  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 26 }, (_, index) => ({
        id: index,
        left: `${(index * 17) % 100}%`,
        delay: `${(index % 6) * 0.14}s`,
        duration: `${2.8 + (index % 5) * 0.35}s`,
        color: ["#f97316", "#22c55e", "#ef4444", "#eab308", "#0ea5e9"][
          index % 5
        ],
        rotate: `${(index % 7) * 18}deg`,
      })),
    [],
  );

  const profileIdsSignature = useMemo(
    () => profileSet.profiles.map((profile) => profile.id).join("|"),
    [profileSet.profiles],
  );

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
    setSwipeDecisions({});
    setHasSubmittedSwipeSummary(false);
    setSwipeStartX(null);
    setSwipeOffsetX(0);
    setIsSwipeDragging(false);
    setMatchedProfile(null);
    setCurrentIndex(0);
  }, [profileIdsSignature]);

  useEffect(() => {
    if (!matchedProfile) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [matchedProfile]);

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

  const submitSwipeSummary = (decisions: Record<string, SwipeDecision>) => {
    if (!sendMessage || hasSubmittedSwipeSummary) {
      return;
    }

    const likedProfiles = profileSet.profiles.filter(
      (profile) => decisions[profile.id] === "like",
    );
    const passedProfiles = profileSet.profiles.filter(
      (profile) => decisions[profile.id] === "pass",
    );

    const likedSummary =
      likedProfiles.length > 0
        ? likedProfiles
            .map(
              (p) =>
                `${p.name} (${p.type.replace("_", " ")}, traits: ${p.traits.slice(0, 4).join(", ")})`,
            )
            .join("; ")
        : "none";

    const passedSummary =
      passedProfiles.length > 0
        ? passedProfiles
            .map(
              (p) =>
                `${p.name} (${p.type.replace("_", " ")}, traits: ${p.traits.slice(0, 4).join(", ")})`,
            )
            .join("; ")
        : "none";

    sendMessage({
      role: "user",
      parts: [
        {
          type: "text",
          text: `I finished swiping through all my matches. I liked: ${likedSummary}. I passed on: ${passedSummary}. Based on these swipe decisions, ask me 2-3 targeted follow-up questions to understand what mattered most to me — look for patterns in the traits I liked vs. passed on and ask about those specifically.`,
        },
      ],
    });

    setHasSubmittedSwipeSummary(true);
  };

  const registerSwipeDecision = (decision: SwipeDecision) => {
    if (matchedProfile) {
      return;
    }

    const activeProfile = profileSet.profiles[currentIndex];

    if (!activeProfile) {
      return;
    }

    if (decision === "like") {
      handleSaveMatch(activeProfile);
    }

    const nextDecisions: Record<string, SwipeDecision> = {
      ...swipeDecisions,
      [activeProfile.id]: decision,
    };

    setSwipeDecisions(nextDecisions);

    const nextPendingIndex = profileSet.profiles.findIndex(
      (profile) => !nextDecisions[profile.id],
    );

    if (nextPendingIndex >= 0) {
      setCurrentIndex(nextPendingIndex);
      return;
    }

    setCurrentIndex(profileSet.profiles.length - 1);
    submitSwipeSummary(nextDecisions);
  };

  const handleChooseMatch = async (profile: PartnerProfile) => {
    if (!savedProfileKeys.has(`${documentId}:${profile.id}`)) {
      await handleSaveMatch(profile);
    }

    clearSessionLocalStorage();
    setSavedMatches([]);
    setMatchedProfile(profile);
  };

  const resetSwipe = () => {
    setSwipeStartX(null);
    setSwipeOffsetX(0);
    setIsSwipeDragging(false);
  };

  const handleSwipeStart = (x: number) => {
    if (isSwipePhaseComplete || matchedProfile) {
      return;
    }

    setSwipeStartX(x);
    setIsSwipeDragging(true);
  };

  const handleSwipeMove = (x: number) => {
    if (swipeStartX === null) {
      return;
    }

    const delta = x - swipeStartX;
    const clamped = Math.max(-140, Math.min(140, delta));
    setSwipeOffsetX(clamped);
  };

  const handleSwipeEnd = () => {
    const activeProfile = profileSet.profiles[currentIndex];

    if (!activeProfile) {
      resetSwipe();
      return;
    }

    const threshold = 90;

    if (swipeOffsetX >= threshold) {
      registerSwipeDecision("like");
    } else if (swipeOffsetX <= -threshold) {
      registerSwipeDecision("pass");
    }

    resetSwipe();
  };

  const isInteractiveElement = (target: EventTarget | null) => {
    if (!(target instanceof Element)) {
      return false;
    }

    return Boolean(target.closest("button,a,input,textarea,select"));
  };

  const swipedCount = profileSet.profiles.reduce(
    (count, profile) => (swipeDecisions[profile.id] ? count + 1 : count),
    0,
  );
  const isSwipePhaseComplete =
    profileSet.profiles.length > 0 &&
    swipedCount === profileSet.profiles.length;
  const activeProfileDecision = profileSet.profiles[currentIndex]
    ? swipeDecisions[profileSet.profiles[currentIndex].id]
    : undefined;

  return (
    <div className="w-full rounded-xl border border-border bg-background p-4">
      {!isSwipePhaseComplete && (
        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          Swipe through every match first. After all swipes, chat will ask why
          you made those choices and unlock full review navigation.
        </p>
      )}

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
            {isSwipePhaseComplete && (
              <div className="flex items-center gap-2">
                <button
                  className="rounded-full border border-zinc-200 px-2.5 py-1 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  disabled={currentIndex === 0}
                  onClick={() =>
                    setCurrentIndex((index) => Math.max(0, index - 1))
                  }
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
            )}
          </div>

          <div
            className="relative"
            onPointerCancel={handleSwipeEnd}
            onPointerDown={(event) => {
              if (isInteractiveElement(event.target) || isSwipePhaseComplete) {
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
              className={
                isSwipeDragging
                  ? "transition-none"
                  : "transition-transform duration-200"
              }
              style={{
                transform: `translateX(${swipeOffsetX}px) rotate(${swipeOffsetX / 25}deg)`,
              }}
            >
              <ProfileCard
                isSaved={savedProfileKeys.has(
                  `${documentId}:${profileSet.profiles[currentIndex].id}`,
                )}
                isSaving={
                  savingProfileId === profileSet.profiles[currentIndex].id
                }
                key={profileSet.profiles[currentIndex].id}
                onChooseMatch={handleChooseMatch}
                onSave={isSwipePhaseComplete ? handleSaveMatch : undefined}
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

          {!isSwipePhaseComplete && (
            <div className="-mt-1 mb-3 flex items-center justify-center gap-3">
              <button
                aria-label="Pass on this match"
                className="inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60"
                disabled={Boolean(activeProfileDecision)}
                onClick={() => registerSwipeDecision("pass")}
                type="button"
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  ←
                </span>
                <span className="ml-2">Pass</span>
              </button>

              <button
                aria-label="Like this match"
                className="inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-green-200 bg-green-50 px-4 text-sm font-semibold text-green-700 transition-colors hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-green-900/70 dark:bg-green-950/40 dark:text-green-300 dark:hover:bg-green-950/60"
                disabled={Boolean(activeProfileDecision)}
                onClick={() => registerSwipeDecision("like")}
                type="button"
              >
                <span className="mr-2">Like</span>
                <span aria-hidden="true" className="text-lg leading-none">
                  →
                </span>
              </button>
            </div>
          )}

          <p className="-mt-2 mb-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
            {isSwipePhaseComplete
              ? "Swiping complete. Use Prev/Next to review all matches."
              : `Swipe left to pass, swipe right to like & save, or use the arrow buttons. (${swipedCount}/${profileSet.profiles.length} done${activeProfileDecision ? `, current: ${activeProfileDecision}` : ""})`}
          </p>

          {isSwipePhaseComplete && (
            <p className="mt-1 text-center text-xs text-zinc-400 dark:text-zinc-500">
              💬 Head to the chat to share what you liked or didn&apos;t like —
              DAM will refine your next set of matches based on your feedback.
            </p>
          )}
        </>
      )}

      {matchedProfile && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/75 px-4 py-6 backdrop-blur-sm">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {confettiPieces.map((piece) => (
              <span
                className="absolute top-[-10%] h-4 w-2 rounded-full opacity-90"
                key={piece.id}
                style={{
                  left: piece.left,
                  backgroundColor: piece.color,
                  transform: `rotate(${piece.rotate})`,
                  animation: `confetti-fall ${piece.duration} linear ${piece.delay} infinite`,
                }}
              />
            ))}
          </div>

          <div className="relative z-10 mx-auto flex min-h-full max-w-6xl items-center justify-center">
            <div className="w-full overflow-hidden rounded-[2rem] border border-[#c3b8b5] bg-white shadow-2xl dark:bg-zinc-950">
              <div className="bg-[#e6e1df] px-6 py-8 text-white md:px-8">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#4d0a05]">
                  Match Locked In
                </p>
                <p className="mt-3 max-w-2xl text-sm md:text-base text-[#4d0a05]">
                  You picked {matchedProfile.name}, and DAM is officially
                  calling it: yay, you matched.
                </p>
              </div>

              <div className="bg-[#ebe7e6]">
                <div className="pt-6">
                  <ProfileCard profile={matchedProfile} />
                </div>

                <div className="flex flex-col justify-center gap-4 bg-[#ebe7e6] pb-6 pr-6 pl-6">
                  <div>
                    <h3 className="mt-2 text-2xl font-semibold text-[#4d0a05] dark:text-zinc-100">
                      Session complete.
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-[#4d0a05] dark:text-zinc-300">
                      The current round is over so you can enjoy the moment. If
                      you want to run it back, start a brand new chat session
                      and DAM will generate a fresh set of matches.
                    </p>
                  </div>

                  <button
                    className="inline-flex items-center justify-center rounded-full bg-[#4d0a05] px-5 py-3 text-sm font-semibold text-[#ebe7e6] transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                    onClick={() => {
                      clearSessionLocalStorage();
                      router.push("/");
                      router.refresh();
                    }}
                    type="button"
                  >
                    Start a new chat session
                  </button>
                </div>
              </div>
            </div>
          </div>

          <style jsx>{`
            @keyframes confetti-fall {
              0% {
                transform: translate3d(0, -12vh, 0) rotate(0deg);
              }

              100% {
                transform: translate3d(0, 115vh, 0) rotate(540deg);
              }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
