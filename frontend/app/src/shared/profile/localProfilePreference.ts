const selectedUserStorageKey = "theseus.localUserId";

export function readStoredUserId(): number | null {
  try {
    const value = Number(window.localStorage.getItem(selectedUserStorageKey));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function storeUserId(userId: number) {
  try {
    window.localStorage.setItem(selectedUserStorageKey, String(userId));
  } catch {
    // The in-memory selection still works when browser storage is unavailable.
  }
}

export function clearStoredUserId() {
  try {
    window.localStorage.removeItem(selectedUserStorageKey);
  } catch {
    // Nothing else is required when browser storage is unavailable.
  }
}
