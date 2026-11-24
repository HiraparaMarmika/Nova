import { describe, expect, it } from "vitest";
import { berlinLocalStamp, berlinLocalToUtc, isValidAvailability, recurrenceDates } from "./scheduling";

describe("scheduling", () => {
  it("generates the configured recurring horizon", () => {
    const dates = recurrenceDates(new Date("2026-11-16T09:00:00Z"), 2, 4);
    expect(dates.map(date => date.toISOString())).toEqual(["2026-11-16T09:00:00.000Z", "2026-11-30T09:00:00.000Z", "2026-12-14T09:00:00.000Z", "2026-12-28T09:00:00.000Z"]);
  });
  it("stores the Europe/Berlin wall time across daylight saving time", () => {
    expect(berlinLocalStamp(new Date("2026-03-29T08:00:00Z"))).toBe("2026-03-29T10:00");
    expect(berlinLocalToUtc("2026-11-30", "10:00").toISOString()).toBe("2026-11-30T09:00:00.000Z");
  });
  it("accepts multiple non-overlapping ranges on a weekday", () => {
    expect(isValidAvailability([
      { weekday: 1, startsAt: "09:00", endsAt: "12:00" },
      { weekday: 1, startsAt: "13:00", endsAt: "17:00" },
    ])).toBe(true);
  });
  it("rejects invalid times and overlapping ranges", () => {
    expect(isValidAvailability([{ weekday: 1, startsAt: "09:00", endsAt: "09:00" }])).toBe(false);
    expect(isValidAvailability([
      { weekday: 1, startsAt: "09:00", endsAt: "12:00" },
      { weekday: 1, startsAt: "11:30", endsAt: "13:00" },
    ])).toBe(false);
  });
});
