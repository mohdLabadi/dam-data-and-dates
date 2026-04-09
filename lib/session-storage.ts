export const SAVED_MATCHES_STORAGE_KEY = "dam-saved-matches";

export function clearSessionLocalStorage() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SAVED_MATCHES_STORAGE_KEY);
}