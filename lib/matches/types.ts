import type { PartnerProfile } from "@/lib/ai/preference-schema";

export type SavedMatchRecord = {
  id: string;
  createdAt: string;
  userId: string;
  documentId: string;
  profileId: string;
  profile: PartnerProfile;
};

export const SAVED_MATCHES_STORAGE_KEY = "dam-saved-matches";
