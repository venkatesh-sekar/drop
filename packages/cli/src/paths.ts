import { basename, dirname, resolve } from "node:path";

/** Folder names that describe build output rather than the project. */
const BUILD_DIR_NAMES = new Set(["dist", "build", "out", "public", "site", "_site", "www", "html"]);

const PATH_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export const RESERVED_PATHS = new Set([
  "api", "auth", "cli", "drops", "admin", "login", "logout", "static", "_next",
  "assets", "favicon.ico", "robots.txt", "health", "healthz", "sites", "drop",
  "www", "docs", "help", "settings", "account", "me", "new",
]);

/** lowercase, spaces/underscores to '-', strip anything else, collapse and trim '-'. */
export function normalizePath(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isValidPath(path: string): boolean {
  return PATH_RE.test(path) && !RESERVED_PATHS.has(path);
}

/**
 * Suggest a site path from a folder. A folder that is obviously build output
 * ("dist", "build", ...) borrows its parent's name instead.
 */
export function suggestPathFromFolder(folderPath: string): string {
  const absolute = resolve(folderPath);
  let name = basename(absolute);
  if (BUILD_DIR_NAMES.has(name.toLowerCase())) {
    const parent = basename(dirname(absolute));
    if (parent && parent !== "" && parent !== "/") name = parent;
  }
  return normalizePath(name);
}
