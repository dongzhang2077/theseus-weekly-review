import { describe, expect, it } from "vitest";
import { resolveInitialTab } from "./tabs";

describe("resolveInitialTab", () => {
  it.each(["review", "signals", "track", "plan"] as const)(
    "opens the %s tab for a deterministic demo link",
    (tab) => {
      expect(resolveInitialTab(`?tab=${tab}`)).toBe(tab);
    }
  );

  it("falls back to Review for missing or unknown tabs", () => {
    expect(resolveInitialTab("")).toBe("review");
    expect(resolveInitialTab("?tab=settings")).toBe("review");
  });
});
