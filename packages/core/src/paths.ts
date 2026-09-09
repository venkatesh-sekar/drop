export const RESERVED_PATHS: readonly string[] = [
  "api",
  "auth",
  "cli",
  "install",
  "drops",
  "admin",
  "login",
  "logout",
  "static",
  "_next",
  "assets",
  "favicon.ico",
  "robots.txt",
  "health",
  "healthz",
  "sites",
  "drop",
  "www",
  "docs",
  "help",
  "settings",
  "account",
  "me",
  "new",
];

const RESERVED = new Set(RESERVED_PATHS);

const VALID_PATH = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

/** lowercase, spaces/underscores → '-', strip anything else, collapse and trim '-'. */
export function normalizePath(input: string): string {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isValidPath(path: string): boolean {
  return path.length >= 1 && path.length <= 64 && VALID_PATH.test(path);
}

export function isReservedPath(path: string): boolean {
  return RESERVED.has(path.toLowerCase());
}

export type ValidatePathResult =
  | { ok: true; path: string }
  | { ok: false; error: "invalid_path" | "reserved_path"; message: string };

export function validatePath(input: string): ValidatePathResult {
  const path = normalizePath(input);
  if (!isValidPath(path)) {
    return {
      ok: false,
      error: "invalid_path",
      message:
        "Path must be 1-64 characters of lowercase letters, numbers and hyphens, starting and ending with a letter or number.",
    };
  }
  if (isReservedPath(path)) {
    return {
      ok: false,
      error: "reserved_path",
      message: `"${path}" is reserved. Pick a different path.`,
    };
  }
  return { ok: true, path };
}

const BUILD_DIR_NAMES = new Set([
  "dist",
  "build",
  "out",
  "public",
  "site",
  "_site",
  "www",
  "html",
]);

/** True for folder names that describe build output ("dist") rather than the project. */
export function isBuildOutputName(name: string): boolean {
  return BUILD_DIR_NAMES.has(String(name ?? "").toLowerCase());
}

/** Suggest a path from a folder path; build-output folder names fall back to the parent. */
export function suggestPathFromFolder(folderPath: string): string {
  const parts = String(folderPath ?? "")
    .replace(/\\/g, "/")
    .split("/")
    .filter((p) => p && p !== ".");
  let base = parts[parts.length - 1] ?? "";
  if (isBuildOutputName(base)) {
    base = parts[parts.length - 2] ?? base;
  }
  return normalizePath(base);
}

/** Suggest a path from a single file name: "Q3 Report.html" → "q3-report". */
export function suggestPathFromFile(fileName: string): string {
  const base = String(fileName ?? "").replace(/\\/g, "/").split("/").pop() ?? "";
  return normalizePath(base.replace(/\.[^.]+$/, ""));
}
