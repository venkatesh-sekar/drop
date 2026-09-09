import { unzipSync } from "fflate";
import { config as defaultConfig } from "./config";

export type ArchiveErrorCode =
  | "invalid_archive"
  | "missing_index"
  | "too_many_files"
  | "file_too_large"
  | "site_too_large"
  | "archive_too_large";

export class ArchiveError extends Error {
  readonly code: ArchiveErrorCode;
  constructor(code: ArchiveErrorCode, message: string) {
    super(message);
    this.name = "ArchiveError";
    this.code = code;
  }
}

export interface ArchiveLimits {
  maxFiles: number;
  maxFileBytes: number;
  maxSiteBytes: number;
  maxArchiveBytes: number;
}

export interface ArchiveFile {
  path: string;
  bytes: Uint8Array;
}

export interface ValidatedArchive {
  files: ArchiveFile[];
  warnings: string[];
  totalBytes: number;
}

export const ABSOLUTE_PATH_WARNING =
  "Absolute asset paths will break under /<path>/. Use relative paths or set your build's base path.";

const SKIP_BASENAMES = new Set([".DS_Store", "Thumbs.db"]);
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

function defaultLimits(): ArchiveLimits {
  return {
    maxFiles: defaultConfig.maxFiles,
    maxFileBytes: defaultConfig.maxFileBytes,
    maxSiteBytes: defaultConfig.maxSiteBytes,
    maxArchiveBytes: defaultConfig.maxArchiveBytes,
  };
}

function isSkipped(name: string): boolean {
  const segments = name.split("/");
  if (segments.some((s) => s === "__MACOSX" || s === ".git")) return true;
  const base = segments[segments.length - 1] ?? "";
  return SKIP_BASENAMES.has(base);
}

function assertSafePath(name: string): void {
  const bad = (why: string): never => {
    throw new ArchiveError("invalid_archive", `Unsafe path in archive: ${name} (${why}).`);
  };
  if (name.includes("\\")) bad("backslashes are not allowed");
  if (name.startsWith("/")) bad("absolute paths are not allowed");
  if (CONTROL_CHARS.test(name)) bad("control characters are not allowed");
  if (Buffer.byteLength(name, "utf8") > 255) bad("name is longer than 255 bytes");
  for (const segment of name.split("/")) {
    if (segment === "") bad("empty path segment");
    if (segment === "." || segment === "..") bad("path traversal");
  }
}

/** Validate and normalize a zip archive into a flat file list ready for upload. */
export function validateArchive(
  zipBytes: Uint8Array,
  limits: Partial<ArchiveLimits> = {},
): ValidatedArchive {
  const lim: ArchiveLimits = { ...defaultLimits(), ...limits };

  if (zipBytes.byteLength > lim.maxArchiveBytes) {
    throw new ArchiveError(
      "archive_too_large",
      `Archive is ${zipBytes.byteLength} bytes, over the ${lim.maxArchiveBytes} byte limit.`,
    );
  }

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zipBytes);
  } catch (err) {
    throw new ArchiveError(
      "invalid_archive",
      `Could not read the archive: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  let files: ArchiveFile[] = [];
  for (const [rawName, bytes] of Object.entries(entries)) {
    if (rawName.endsWith("/")) continue; // directory entry
    if (isSkipped(rawName)) continue;
    assertSafePath(rawName);
    files.push({ path: rawName, bytes });
  }

  if (files.length === 0) {
    throw new ArchiveError("invalid_archive", "The archive contains no usable files.");
  }

  // Strip a single wrapping top-level folder.
  const tops = new Set(files.map((f) => f.path.split("/")[0] ?? ""));
  if (tops.size === 1) {
    const top = [...tops][0]!;
    const allNested = files.every((f) => f.path.includes("/"));
    const indexAtRoot = files.some((f) => f.path === "index.html");
    if (allNested && !indexAtRoot) {
      files = files.map((f) => ({ ...f, path: f.path.slice(top.length + 1) }));
    }
  }

  const index = files.find((f) => f.path === "index.html");
  if (!index) {
    throw new ArchiveError(
      "missing_index",
      "No index.html found at the root of the upload. Drop needs an index.html.",
    );
  }

  if (files.length > lim.maxFiles) {
    throw new ArchiveError(
      "too_many_files",
      `Archive contains ${files.length} files, over the limit of ${lim.maxFiles}.`,
    );
  }

  let totalBytes = 0;
  for (const file of files) {
    if (file.bytes.byteLength > lim.maxFileBytes) {
      throw new ArchiveError(
        "file_too_large",
        `${file.path} is ${file.bytes.byteLength} bytes, over the per-file limit of ${lim.maxFileBytes}.`,
      );
    }
    totalBytes += file.bytes.byteLength;
  }
  if (totalBytes > lim.maxSiteBytes) {
    throw new ArchiveError(
      "site_too_large",
      `Deployment is ${totalBytes} bytes, over the limit of ${lim.maxSiteBytes}.`,
    );
  }

  const warnings: string[] = [];
  if (hasAbsoluteAssetPaths(new TextDecoder().decode(index.bytes))) {
    warnings.push(ABSOLUTE_PATH_WARNING);
  }

  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { files, warnings, totalBytes };
}

/** True when index.html references root-absolute assets (which break under /<path>/). */
export function hasAbsoluteAssetPaths(html: string): boolean {
  return (
    /\b(?:src|href)\s*=\s*["']\/(?!\/)/i.test(html) || /url\(\s*["']?\/(?!\/)/i.test(html)
  );
}
