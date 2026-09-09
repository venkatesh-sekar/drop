import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
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

export function zipFiles(files: CollectedFile[]): Uint8Array {
  const zippable: Zippable = {};
  for (const file of files) {
    const extension = file.path.split(".").pop()?.toLowerCase() ?? "";
    const level = STORED_EXTENSIONS.has(extension) ? 0 : 6;
    zippable[file.path] = [file.bytes, { level: level as 0 | 6 }];
  }
  return zipSync(zippable, { level: 6 });
}
