import { describe, expect, it } from "vitest";
import { formatReviewWeek, shiftReviewWeek, weekContainingDate } from "./reviewWeek";

describe("reviewWeek", () => {
  it("maps any selected date to its Monday through Sunday range", () => {
    expect(weekContainingDate("2026-07-18")).toEqual({
      start: "2026-07-13",
      end: "2026-07-19"
    });
    expect(weekContainingDate("2026-07-19")).toEqual({
      start: "2026-07-13",
      end: "2026-07-19"
    });
  });

  it("rejects invalid calendar dates", () => {
    expect(weekContainingDate("2026-02-30")).toBeNull();
    expect(weekContainingDate("July 18")).toBeNull();
  });

  it("moves and formats real week ranges", () => {
    const range = { start: "2026-07-13", end: "2026-07-19" };
    expect(shiftReviewWeek(range, -1)).toEqual({ start: "2026-07-06", end: "2026-07-12" });
    expect(shiftReviewWeek(range, 1)).toEqual({ start: "2026-07-20", end: "2026-07-26" });
    expect(formatReviewWeek(range)).toBe("Jul 13 - Jul 19");
  });
});
