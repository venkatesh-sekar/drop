/** Pure resolution helpers: request path → storage key. No I/O. */

export interface ServingSite {
  id: string;
  storage_prefix: string;
  spa: boolean;
}

export type SiteLookup = (path: string) => Promise<ServingSite | null>;

/**
 * Wrap a lookup in a tiny in-memory cache. Negative results are cached too, so a flood of
 * requests for an unknown or expired path does not hammer Postgres.
 */
export function cachedLookup(lookup: SiteLookup, ttlMs = 5_000): SiteLookup {
  const cache = new Map<string, { at: number; value: ServingSite | null }>();
  const inflight = new Map<string, Promise<ServingSite | null>>();

  return async function get(path: string): Promise<ServingSite | null> {
    const hit = cache.get(path);
    if (hit && Date.now() - hit.at < ttlMs) return hit.value;
    if (hit) cache.delete(path);

    const pending = inflight.get(path);
    if (pending) return pending;

    const promise = lookup(path)
      .then((value) => {
        cache.set(path, { at: Date.now(), value });
        return value;
      })
      .finally(() => inflight.delete(path));
    inflight.set(path, promise);
    return promise;
  };
}

function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Turn the part of the URL after `/<site-path>/` into a relative file inside the site.
 * Returns null when the request is unsafe (traversal, empty segments, backslashes,
 * control characters).
 */
export function resolveRelative(rest: string): string | null {
  let raw = rest;
  if (raw === "") raw = "index.html";
  else if (raw.endsWith("/")) raw += "index.html";

  const segments: string[] = [];
  for (const rawSegment of raw.split("/")) {
    let segment: string;
    try {
      segment = decodeURIComponent(rawSegment);
    } catch {
      return null;
    }
    if (segment === "" || segment === "." || segment === "..") return null;
    if (segment.includes("\\") || segment.includes("/")) return null;
    if (hasControlChars(segment)) return null;
    segments.push(segment);
  }
  return segments.join("/");
}

/** True when the last segment of `rel` carries a file extension. */
export function hasExtension(rel: string): boolean {
  const base = rel.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot > 0 && dot < base.length - 1;
}
