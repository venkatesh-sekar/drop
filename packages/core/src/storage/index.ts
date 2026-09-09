import type { Config } from "../config";
import { config as defaultConfig } from "../config";
import { S3Storage } from "./s3";
import { FsStorage } from "./fs";

export interface StorageObject {
  body: ReadableStream<Uint8Array>;
  size: number;
  contentType?: string;
}

export interface Storage {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<StorageObject | null>;
  deletePrefix(prefix: string): Promise<void>;
}

export function createStorage(config: Config = defaultConfig): Storage {
  return config.storageDriver === "fs" ? new FsStorage(config) : new S3Storage(config);
}

export interface UploadFile {
  path: string;
  bytes: Uint8Array;
}

const CONCURRENCY = 8;

/** Upload files under `prefix` with bounded concurrency. Returns total bytes written. */
export async function putMany(
  storage: Storage,
  files: UploadFile[],
  prefix: string,
  contentTypeFor: (filename: string) => string,
): Promise<number> {
  const clean = prefix.replace(/\/+$/, "");
  let total = 0;
  let index = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = index++;
      const file = files[i];
      if (!file) return;
      await storage.put(`${clean}/${file.path}`, file.bytes, contentTypeFor(file.path));
      total += file.bytes.byteLength;
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, files.length || 1) }, () => worker()),
  );
  return total;
}

export { S3Storage } from "./s3";
export { FsStorage } from "./fs";
