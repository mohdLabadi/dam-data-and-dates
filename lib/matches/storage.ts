import {
  SAVED_MATCHES_STORAGE_KEY,
  type SavedMatchRecord,
} from "@/lib/matches/types";

export function readSavedMatchesFromLocalStorage(): SavedMatchRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(SAVED_MATCHES_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as SavedMatchRecord[];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeSavedMatchesToLocalStorage(matches: SavedMatchRecord[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      SAVED_MATCHES_STORAGE_KEY,
      JSON.stringify(matches)
    );
  } catch {
    // Quota exceeded — retry without photo data
    try {
      const stripped = matches.map((match) => ({
        ...match,
        profile: { ...match.profile, profilePhotoDataUrl: undefined },
      }));
      window.localStorage.setItem(
        SAVED_MATCHES_STORAGE_KEY,
        JSON.stringify(stripped)
      );
    } catch {
      // Still too large — skip local persistence; server is the source of truth
    }
  }
}
