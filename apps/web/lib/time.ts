const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function plural(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? "" : "s"}`
}

/** "5 minutes", "3 hours", "24 days" — the magnitude of a duration in ms. */
export function humanDuration(ms: number): string {
  const abs = Math.abs(ms)
  if (abs < MINUTE) return "less than a minute"
  if (abs < HOUR) return plural(Math.round(abs / MINUTE), "minute")
  if (abs < DAY) return plural(Math.round(abs / HOUR), "hour")
  if (abs < 60 * DAY) return plural(Math.round(abs / DAY), "day")
  return plural(Math.round(abs / (30 * DAY)), "month")
}

/** "Updated 5 minutes ago". */
export function timeAgo(iso: string | Date, now: number = Date.now()): string {
  const then = new Date(iso).getTime()
  const delta = now - then
  if (delta < MINUTE) return "just now"
  return `${humanDuration(delta)} ago`
}

/**
 * The expiry half of a status line: "Permanent", "Expires in 24 days",
 * "Expires in 3 hours", "Expired 2 days ago".
 */
export function expiryLabel(
  expiresAt: string | null,
  status: "active" | "expired" = "active",
  now: number = Date.now(),
): string {
  if (expiresAt === null) return status === "expired" ? "Expired" : "Permanent"
  const at = new Date(expiresAt).getTime()
  if (at <= now || status === "expired") return `Expired ${humanDuration(now - at)} ago`
  return `Expires in ${humanDuration(at - now)}`
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  const rounded = value >= 100 || unit === 0 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${units[unit]}`
}

export function fileCountLabel(count: number): string {
  return plural(count, "file")
}
