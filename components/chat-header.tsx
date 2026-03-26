"use client";

import { useRouter } from "next/navigation";
import { memo, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { PartnerProfile } from "@/lib/ai/preference-schema";
import { ProfileCard } from "./profiles-chat-cards";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlusIcon } from "./icons";
import { guestRegex } from "@/lib/constants";
import type { VisibilityType } from "./visibility-selector";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type SavedMatchRecord = {
  id: string;
  documentId: string;
  profileId: string;
  profile: PartnerProfile;
};

function PureChatHeader({
  chatId: _chatId,
  selectedVisibilityType: _selectedVisibilityType,
  isReadonly: _isReadonly,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const isGuest = !session?.user || guestRegex.test(session.user.email ?? "");
  const [isSavedMatchesOpen, setIsSavedMatchesOpen] = useState(false);
  const [savedMatches, setSavedMatches] = useState<SavedMatchRecord[]>([]);
  const [isSavedLoading, setIsSavedLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const openSavedMatches = async () => {
    setIsSavedMatchesOpen(true);
    setIsSavedLoading(true);

    try {
      const response = await fetch("/api/matches");

      if (!response.ok) {
        throw new Error("failed to fetch saved matches");
      }

      const matches = (await response.json()) as SavedMatchRecord[];

      if (matches.length > 0) {
        setSavedMatches(matches);
        // Heal stale localStorage entries (e.g. photos stripped by old code)
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem("dam-saved-matches", JSON.stringify(matches));
          } catch {}
        }
      } else {
        const raw = typeof window !== "undefined"
          ? window.localStorage.getItem("dam-saved-matches")
          : null;
        const local = raw ? (JSON.parse(raw) as SavedMatchRecord[]) : [];
        setSavedMatches(Array.isArray(local) ? local : []);
      }
    } catch {
      const raw = typeof window !== "undefined"
        ? window.localStorage.getItem("dam-saved-matches")
        : null;
      const local = raw ? (JSON.parse(raw) as SavedMatchRecord[]) : [];
      setSavedMatches(Array.isArray(local) ? local : []);
    } finally {
      setIsSavedLoading(false);
    }
  };

  const removeSavedMatch = async (id: string) => {
    setRemovingId(id);

    // Always remove from localStorage
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem("dam-saved-matches");
        const local = raw ? (JSON.parse(raw) as SavedMatchRecord[]) : [];
        window.localStorage.setItem(
          "dam-saved-matches",
          JSON.stringify(local.filter((m) => m.id !== id)),
        );
      } catch {}
    }

    // Also attempt server delete
    try {
      await fetch(`/api/matches?id=${id}`, { method: "DELETE" });
    } catch {}

    setSavedMatches((current) => current.filter((match) => match.id !== id));
    setRemovingId(null);
  };

  const accountLabel =
    !isGuest &&
    (session.user?.name?.trim() || session.user?.email?.split("@")[0])
      ? session.user?.name?.trim() || session.user?.email?.split("@")[0]
      : "Account";

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border/70 bg-background px-2 py-1.5 md:px-2">
      <div
        className="px-1 text-2xl leading-none tracking-normal text-primary italic md:text-3xl"
        style={{ fontFamily: "var(--font-marker), 'Brush Script MT', cursive" }}
      >
        Be My Cupid
      </div>

      <div className="flex items-center gap-2">
        <Button
          className="h-8 px-2 text-xs md:h-fit"
          onClick={openSavedMatches}
          variant="outline"
        >
          Saved Matches
        </Button>

        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="h-8 px-2 md:h-fit md:px-2"
                onClick={() => {
                  router.push("/");
                  router.refresh();
                }}
                variant="outline"
              >
                <PlusIcon />
                <span className="md:sr-only">New Session</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Start a new chat session
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 max-w-40 truncate">
              {accountLabel}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isGuest ? (
              <>
                <DropdownMenuItem asChild>
                  <Link href="/login">Log in</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/register">Create account</Link>
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive cursor-pointer"
                onSelect={() => signOut({ callbackUrl: "/" })}
              >
                Sign out
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isSavedMatchesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-background shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="font-semibold text-base">Saved Matches</h2>
              <Button
                className="h-8 px-2"
                onClick={() => setIsSavedMatchesOpen(false)}
                variant="ghost"
              >
                Close
              </Button>
            </div>

            <div className="max-h-[calc(90vh-57px)] overflow-y-auto p-4">
              {isSavedLoading ? (
                <p className="text-sm text-zinc-500">
                  Loading saved matches...
                </p>
              ) : savedMatches.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No saved matches yet. Save profiles from chat to see them
                  here.
                </p>
              ) : (
                <div className="space-y-2">
                  {savedMatches.map((match) => (
                    <ProfileCard
                      isRemoving={removingId === match.id}
                      key={match.id}
                      onRemove={() => removeSavedMatch(match.id)}
                      profile={match.profile}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isReadonly === nextProps.isReadonly
  );
});
