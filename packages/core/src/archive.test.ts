import { zipSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { ABSOLUTE_PATH_WARNING, ArchiveError, validateArchive } from "./archive";

const LIMITS = {
  maxFiles: 100,
  maxFileBytes: 1024,
  maxSiteBytes: 4096,
  maxArchiveBytes: 65536,
};

function zip(entries: Record<string, string | Uint8Array>): Uint8Array {
  const data: Record<string, Uint8Array> = {};
  for (const [name, value] of Object.entries(entries)) {
    data[name] = typeof value === "string" ? strToU8(value) : value;
  }
  return zipSync(data);
}

function expectCode(fn: () => unknown, code: string): void {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ArchiveError);
    expect((err as ArchiveError).code).toBe(code);
    expect((err as ArchiveError).message.length).toBeGreaterThan(0);
    return;
  }
  throw new Error(`expected ArchiveError(${code}) to be thrown`);
}

describe("validateArchive", () => {
  it("accepts a flat site", () => {
    const result = validateArchive(
      zip({ "index.html": "<h1>hi</h1>", "style.css": "body{}", "assets/logo.svg": "<svg/>" }),
      LIMITS,
    );
    expect(result.files.map((f) => f.path)).toEqual([
      "assets/logo.svg",
      "index.html",
      "style.css",
    ]);
    expect(result.warnings).toEqual([]);
    expect(result.totalBytes).toBeGreaterThan(0);
  });

  it("rejects path traversal", () => {
    expectCode(() => validateArchive(zip({ "index.html": "x", "../evil.txt": "x" }), LIMITS), "invalid_archive");
  });

  it("rejects absolute entry names", () => {
    expectCode(() => validateArchive(zip({ "index.html": "x", "/etc/passwd": "x" }), LIMITS), "invalid_archive");
  });

  it("rejects backslash entry names", () => {
    expectCode(
      () => validateArchive(zip({ "index.html": "x", "a\\b.txt": "x" }), LIMITS),
      "invalid_archive",
    );
  });

  it("skips __MACOSX, .DS_Store, Thumbs.db and .git", () => {
    const result = validateArchive(
      zip({
        "index.html": "x",
        "__MACOSX/._index.html": "junk",
        ".DS_Store": "junk",
        "assets/.DS_Store": "junk",
        "Thumbs.db": "junk",
        ".git/config": "junk",
      }),
      LIMITS,
    );
    expect(result.files.map((f) => f.path)).toEqual(["index.html"]);
  });

  it("strips a single wrapping top-level folder", () => {
    const result = validateArchive(
      zip({ "site/index.html": "x", "site/assets/app.js": "y" }),
      LIMITS,
    );
    expect(result.files.map((f) => f.path)).toEqual(["assets/app.js", "index.html"]);
  });

  it("does not strip when index.html is already at the root", () => {
    const result = validateArchive(
      zip({ "index.html": "x", "assets/app.js": "y" }),
      LIMITS,
    );
    expect(result.files.map((f) => f.path)).toEqual(["assets/app.js", "index.html"]);
  });

  it("does not strip when there are multiple top-level entries", () => {
    expectCode(
      () => validateArchive(zip({ "a/index.html": "x", "b/app.js": "y" }), LIMITS),
      "missing_index",
    );
  });

  it("errors when index.html is missing", () => {
    expectCode(() => validateArchive(zip({ "app.js": "x" }), LIMITS), "missing_index");
  });

  it("errors on an empty archive", () => {
    expectCode(() => validateArchive(zip({}), LIMITS), "invalid_archive");
  });

  it("errors on non-zip bytes", () => {
    expectCode(() => validateArchive(strToU8("not a zip at all"), LIMITS), "invalid_archive");
  });

  it("enforces the file count limit", () => {
    const entries: Record<string, string> = { "index.html": "x" };
    for (let i = 0; i < 5; i++) entries[`f${i}.txt`] = "x";
    expectCode(
      () => validateArchive(zip(entries), { ...LIMITS, maxFiles: 3 }),
      "too_many_files",
    );
  });

  it("enforces the per-file limit", () => {
    expectCode(
      () => validateArchive(zip({ "index.html": "x", "big.txt": "y".repeat(2000) }), LIMITS),
      "file_too_large",
    );
  });

  it("enforces the total site limit", () => {
    expectCode(
      () =>
        validateArchive(zip({ "index.html": "x", "big.txt": "y".repeat(900) }), {
          ...LIMITS,
          maxSiteBytes: 500,
        }),
      "site_too_large",
    );
  });

  it("enforces the archive limit", () => {
    expectCode(
      () => validateArchive(zip({ "index.html": "x" }), { ...LIMITS, maxArchiveBytes: 10 }),
      "archive_too_large",
    );
  });

  it("warns about absolute asset paths", () => {
    const html = '<link href="/style.css" rel="stylesheet"><script src="/app.js"></script>';
    const result = validateArchive(zip({ "index.html": html }), LIMITS);
    expect(result.warnings).toEqual([ABSOLUTE_PATH_WARNING]);
  });

  it("warns about absolute url() references", () => {
    const html = '<style>body{background:url(/bg.png)}</style>';
    expect(validateArchive(zip({ "index.html": html }), LIMITS).warnings).toEqual([
      ABSOLUTE_PATH_WARNING,
    ]);
  });

  it("does not warn about protocol-relative or relative references", () => {
    const html =
      '<script src="//cdn.example.com/a.js"></script><link href="./style.css" rel="stylesheet">';
    expect(validateArchive(zip({ "index.html": html }), LIMITS).warnings).toEqual([]);
  });
});
