import { beforeEach, describe, expect, it } from "vitest";
import { clearStoredUserId, readStoredUserId, storeUserId } from "./localProfilePreference";

describe("local profile preference", () => {
  beforeEach(() => window.localStorage.clear());

  it("restores a selected positive integer user ID after reload", () => {
    storeUserId(7);
    expect(readStoredUserId()).toBe(7);
  });

  it("ignores missing or invalid stored values", () => {
    expect(readStoredUserId()).toBeNull();
    window.localStorage.setItem("theseus.localUserId", "not-a-user");
    expect(readStoredUserId()).toBeNull();
  });

  it("clears the retained selection", () => {
    storeUserId(7);
    clearStoredUserId();
    expect(readStoredUserId()).toBeNull();
  });
});
