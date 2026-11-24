import { describe, expect, it } from "vitest";
import { coversPostcode, distanceKm } from "./coverage";

describe("cleaner coverage", () => {
  it("always honors an explicit service postcode prefix", () => {
    expect(coversPostcode({ bookingPostcode: "10119", explicitPrefixes: ["101"], basePostcode: null, radiusKm: null })).toBe(true);
  });

  it("matches a postcode inside the cleaner travel radius", () => {
    expect(coversPostcode({ bookingPostcode: "10119", explicitPrefixes: [], basePostcode: "10115", radiusKm: 5, baseLocation: { latitude: 52.532, longitude: 13.384 }, bookingLocation: { latitude: 52.531, longitude: 13.409 } })).toBe(true);
  });

  it("does not guess radius coverage without postcode coordinates", () => {
    expect(coversPostcode({ bookingPostcode: "10119", explicitPrefixes: [], basePostcode: "10115", radiusKm: 20 })).toBe(false);
    expect(distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })).toBeGreaterThan(100);
  });
});
