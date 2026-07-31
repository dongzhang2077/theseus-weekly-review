import { describe, expect, it } from "vitest";
import { resolveInitialTab } from "./tabs";

describe("resolveInitialTab", () => {
  it.each(["track", "insights", "plan"] as const)(
    "opens the %s tab for a deterministic demo link",
    (tab) => {
      expect(resolveInitialTab(`?tab=${tab}`)).toBe(tab);
    }
  );

  it.each(["review", "signals"] as const)(
    "maps the legacy %s link to Insights",
    (tab) => {
      expect(resolveInitialTab(`?tab=${tab}`)).toBe("insights");
    }
  );

  it("falls back to Today for missing or unknown tabs", () => {
    expect(resolveInitialTab("")).toBe("track");
    expect(resolveInitialTab("?tab=settings")).toBe("track");
  });
});
