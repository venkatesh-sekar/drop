import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Config } from "../config";
import { config as baseConfig } from "../config";
import { createStorage, putMany, type Storage } from "./index";
import { contentTypeFor } from "../mime";

let root: string;
let storage: Storage;

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
}

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "drop-fs-storage-"));
  const config: Config = { ...baseConfig, storageDriver: "fs", storageFsRoot: root };
  storage = createStorage(config);
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("FsStorage", () => {
  it("round-trips an object", async () => {
    await storage.put("sites/a/d1/index.html", Buffer.from("<h1>hi</h1>"), "text/html");
    const got = await storage.get("sites/a/d1/index.html");
    expect(got).not.toBeNull();
    expect(got!.size).toBe(11);
    expect(got!.contentType).toBe("text/html; charset=utf-8");
    expect(await readAll(got!.body)).toBe("<h1>hi</h1>");
  });

  it("returns null for a missing key", async () => {
    expect(await storage.get("sites/a/d1/nope.html")).toBeNull();
  });

  it("refuses to read outside the root", async () => {
    expect(await storage.get("../../etc/passwd")).toBeNull();
    await expect(storage.put("../escape.txt", Buffer.from("x"), "text/plain")).rejects.toThrow();
    await expect(storage.put("/abs.txt", Buffer.from("x"), "text/plain")).rejects.toThrow();
  });

  it("uploads many files and deletes by prefix", async () => {
    const files = Array.from({ length: 20 }, (_, i) => ({
      path: `assets/file-${i}.txt`,
      bytes: Buffer.from(`body ${i}`),
    }));
    const total = await putMany(storage, files, "sites/b/d1/", contentTypeFor);
    expect(total).toBe(files.reduce((n, f) => n + f.bytes.byteLength, 0));
    expect(await storage.get("sites/b/d1/assets/file-7.txt")).not.toBeNull();

    await storage.deletePrefix("sites/b/d1");
    expect(await storage.get("sites/b/d1/assets/file-7.txt")).toBeNull();
    // Other prefixes survive.
    expect(await storage.get("sites/a/d1/index.html")).not.toBeNull();
  });
});
