export type { SavedMatchRecord } from "@/lib/matches/types";
export { SAVED_MATCHES_STORAGE_KEY } from "@/lib/matches/types";
export {
  readSavedMatchesFromLocalStorage,
  writeSavedMatchesToLocalStorage,
} from "@/lib/matches/storage";
