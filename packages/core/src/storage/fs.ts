import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { Config } from "../config";
import type { Storage, StorageObject } from "./index";
import { contentTypeFor } from "../mime";

export class FsStorage implements Storage {
  private root: string;

  constructor(config: Config) {
    this.root = path.resolve(config.storageFsRoot);
  }

  private resolve(key: string): string {
    if (!key || key.startsWith("/") || key.includes("\0")) {
      throw new Error(`Unsafe storage key: ${key}`);
    }
    const target = path.resolve(this.root, key);
    const rootWithSep = this.root.endsWith(path.sep) ? this.root : this.root + path.sep;
    if (target !== this.root && !target.startsWith(rootWithSep)) {
      throw new Error(`Unsafe storage key escapes root: ${key}`);
    }
    return target;
  }

  async put(key: string, body: Uint8Array, _contentType: string): Promise<void> {
    const file = this.resolve(key);
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await fsp.writeFile(file, body);
  }

  async get(key: string): Promise<StorageObject | null> {
    let file: string;
    try {
      file = this.resolve(key);
    } catch {
      return null;
    }
    let stat: fs.Stats;
    try {
      stat = await fsp.stat(file);
    } catch {
      return null;
    }
    if (!stat.isFile()) return null;
    const stream = fs.createReadStream(file);
    return {
      body: Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>,
      size: stat.size,
      contentType: contentTypeFor(file),
    };
  }

  async deletePrefix(prefix: string): Promise<void> {
    let target: string;
    try {
      target = this.resolve(prefix.replace(/\/+$/, ""));
    } catch {
      return;
    }
    await fsp.rm(target, { recursive: true, force: true });
  }
}
