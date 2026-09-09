import { readdirSync, readFileSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import { zipSync, type Zippable } from "fflate";

const SKIP_DIRS = new Set([".git", "node_modules"]);
const SKIP_FILES = new Set([".DS_Store", "Thumbs.db"]);

/** Already-compressed payloads: re-deflating them costs time and saves nothing. */
const STORED_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "avif", "ico",
  "woff", "woff2", "zip", "gz", "tgz", "br", "7z", "rar",
  "mp3", "mp4", "m4a", "webm", "ogg", "mov", "pdf",
]);

export interface CollectedFile {
  /** POSIX-style path relative to the folder root. */
  path: string;
  bytes: Uint8Array;
}

export function collectFiles(root: string): CollectedFile[] {
  const files: CollectedFile[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(join(dir, entry.name));
        continue;
      }
      if (!entry.isFile()) continue;
      if (SKIP_FILES.has(entry.name)) continue;
      const absolute = join(dir, entry.name);
      const rel = relative(root, absolute).split(sep).join("/");
      files.push({ path: rel, bytes: new Uint8Array(readFileSync(absolute)) });
    }
  };

  walk(root);
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return files;
}

/** A single file, published on its own. */
export function collectFile(file: string): CollectedFile[] {
  return [{ path: basename(file), bytes: new Uint8Array(readFileSync(file)) }];
}

const HTML_FILE = /\.html?$/i;

/**
 * Mirror of @drop/core's layout rule (packages/core/src/layout.ts), so a hopeless
 * upload fails here instead of after the transfer: the site needs index.html at the
 * root, or the upload is a single html file.
 */
export function hasHomePage(files: CollectedFile[]): boolean {
  const paths = files.map((f) => f.path);
  if (paths.includes("index.html")) return true;
  return paths.length === 1 && !paths[0]!.includes("/") && HTML_FILE.test(paths[0]!);
}

export function zipFiles(files: CollectedFile[]): Uint8Array {
  const zippable: Zippable = {};
  for (const file of files) {
    const extension = file.path.split(".").pop()?.toLowerCase() ?? "";
    const level = STORED_EXTENSIONS.has(extension) ? 0 : 6;
    zippable[file.path] = [file.bytes, { level: level as 0 | 6 }];
  }
  return zipSync(zippable, { level: 6 });
}
