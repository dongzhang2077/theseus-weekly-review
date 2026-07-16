export const LOCAL_USER_HEADER = "X-Theseus-User-Id";

export function localUserHeaders(userId: number, includeJson = false): Record<string, string> {
  return {
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
    [LOCAL_USER_HEADER]: String(userId)
  };
}

export function isValidLocalUserId(userId: number | undefined): userId is number {
  return typeof userId === "number" && Number.isInteger(userId) && userId > 0;
}
