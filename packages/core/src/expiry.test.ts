import { describe, expect, it } from "vitest";
import {
  EXPIRY_PRESET_DAYS,
  MAX_EXPIRY_DAYS,
  expiryDays,
  expiryFor,
  expiresAtFor,
  parseExpiry,
} from "./expiry";

describe("parseExpiry", () => {
  it("accepts never", () => {
    expect(parseExpiry("never")).toBe("never");
  });

  it("accepts whole days from 1 to the maximum", () => {
    expect(parseExpiry("1d")).toBe("1d");
    expect(parseExpiry("7d")).toBe("7d");
    expect(parseExpiry("60d")).toBe("60d");
    expect(parseExpiry(`${MAX_EXPIRY_DAYS}d`)).toBe("365d");
  });

  it("rejects anything else", () => {
    for (const value of ["0d", "366d", "1000d", "-7d", "7", "7.5d", "07d", " 7d", "7D", "", "soon", 7, null, undefined]) {
      expect(parseExpiry(value)).toBeNull();
    }
  });
});

describe("expiryFor", () => {
  it("builds a day expiry from an integer in range", () => {
    expect(expiryFor(7)).toBe("7d");
    expect(expiryFor(365)).toBe("365d");
  });

  it("returns null out of range or for non-integers", () => {
    expect(expiryFor(0)).toBeNull();
    expect(expiryFor(366)).toBeNull();
    expect(expiryFor(7.5)).toBeNull();
    expect(expiryFor(Number.NaN)).toBeNull();
  });
});

describe("expiryDays", () => {
  it("reads the day count, or null for never", () => {
    expect(expiryDays("7d")).toBe(7);
    expect(expiryDays("never")).toBeNull();
  });
});

describe("expiresAtFor", () => {
  it("is null for never", () => {
    expect(expiresAtFor("never")).toBeNull();
  });

  it("adds exactly that many days", () => {
    const now = Date.UTC(2026, 8, 9, 12, 0, 0);
    expect(expiresAtFor("7d", now)?.toISOString()).toBe("2026-09-16T12:00:00.000Z");
    expect(expiresAtFor("60d", now)?.toISOString()).toBe("2026-11-08T12:00:00.000Z");
  });
});

describe("presets", () => {
  it("are 7, 30 and 60 days, all within the maximum", () => {
    expect([...EXPIRY_PRESET_DAYS]).toEqual([7, 30, 60]);
    expect(Math.max(...EXPIRY_PRESET_DAYS)).toBeLessThanOrEqual(MAX_EXPIRY_DAYS);
  });
});
