import { describe, expect, it, vi, afterEach } from "vitest";
import { getTodayRange, getTomorrowRange, getWeekRange } from "./dateUtils";

describe("dateUtils", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("getTodayRange returns today's date for both bounds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 4)); // Sep 4, 2026
    const range = getTodayRange();
    expect(range.dueAfter).toBe("2026-09-04");
    expect(range.dueBefore).toBe("2026-09-04");
  });

  it("getTomorrowRange returns today through tomorrow", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 4)); // Sep 4, 2026
    const range = getTomorrowRange();
    expect(range.dueAfter).toBe("2026-09-04");
    expect(range.dueBefore).toBe("2026-09-05");
  });

  it("getWeekRange returns a 7-day window starting today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 4)); // Sep 4, 2026
    const range = getWeekRange();
    expect(range.dueAfter).toBe("2026-09-04");
    expect(range.dueBefore).toBe("2026-09-10");
  });

  it("getWeekRange handles month boundary correctly", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 28)); // Jan 28, 2026
    const range = getWeekRange();
    expect(range.dueAfter).toBe("2026-01-28");
    expect(range.dueBefore).toBe("2026-02-03");
  });

  it("getWeekRange handles year boundary correctly", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 29)); // Dec 29, 2026
    const range = getWeekRange();
    expect(range.dueAfter).toBe("2026-12-29");
    expect(range.dueBefore).toBe("2027-01-04");
  });
});
