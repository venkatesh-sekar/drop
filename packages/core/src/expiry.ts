/**
 * How long a site lives. "never" is permanent; "<n>d" expires n whole days after the
 * deploy or the change, where 1 <= n <= MAX_EXPIRY_DAYS.
 */
export type Expiry = `${number}d` | "never";

export const MAX_EXPIRY_DAYS = 365;

/** The choices offered as one click in the UI. Anything else in range is "custom". */
export const EXPIRY_PRESET_DAYS = [7, 30, 60] as const;

const DAYS_PATTERN = /^([1-9]\d{0,2})d$/;

/** Build a day expiry from a count, or null when it is not a whole number in range. */
export function expiryFor(days: number): Expiry | null {
  if (!Number.isInteger(days) || days < 1 || days > MAX_EXPIRY_DAYS) return null;
  return `${days}d`;
}

/** Strict: only "never" or "<1-365>d" with no leading zeros or whitespace. */
export function parseExpiry(value: unknown): Expiry | null {
  if (value === "never") return "never";
  if (typeof value !== "string") return null;
  const match = DAYS_PATTERN.exec(value);
  if (!match) return null;
  return expiryFor(Number(match[1]));
}

/** null = permanent. */
export function expiryDays(expiry: Expiry): number | null {
  if (expiry === "never") return null;
  return Number(expiry.slice(0, -1));
}

/** null = permanent. */
export function expiresAtFor(expiry: Expiry, now: number = Date.now()): Date | null {
  const days = expiryDays(expiry);
  if (days === null) return null;
  return new Date(now + days * 24 * 60 * 60 * 1000);
}
