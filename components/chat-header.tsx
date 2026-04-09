"use client";

import { useRouter } from "next/navigation";
import { memo } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
