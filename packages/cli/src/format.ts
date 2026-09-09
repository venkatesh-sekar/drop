const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

function span(ms: number): string {
  if (ms < MINUTE) return "a moment";
  if (ms < HOUR) {
    const n = Math.round(ms / MINUTE);
    return `${n} minute${n === 1 ? "" : "s"}`;
  }
  if (ms < DAY) {
    const n = Math.round(ms / HOUR);
    return `${n} hour${n === 1 ? "" : "s"}`;
  }
  const n = Math.round(ms / DAY);
  return `${n} day${n === 1 ? "" : "s"}`;
}

/** "5 minutes ago" / "in 24 days". */
export function formatRelative(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "-";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "-";
  const delta = then - now;
  return delta >= 0 ? `in ${span(delta)}` : `${span(-delta)} ago`;
}

/** Expiry as a person reads it: "Permanent", "in 24 days", "expired 3 days ago". */
export function formatExpiry(expiresAt: string | null | undefined, now = Date.now()): string {
  if (!expiresAt) return "Permanent";
  const then = Date.parse(expiresAt);
  if (Number.isNaN(then)) return "-";
  if (then <= now) return `expired ${span(now - then)} ago`;
  return `in ${span(then - now)}`;
}

export function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((header, i) =>
    Math.max(header.length, ...rows.map((row) => (row[i] ?? "").length)),
  );
  const line = (cells: string[]) =>
    cells
      .map((cell, i) => (i === cells.length - 1 ? cell : cell.padEnd(widths[i]!)))
      .join("  ")
      .trimEnd();
  return [line(headers), ...rows.map(line)].join("\n");
}
