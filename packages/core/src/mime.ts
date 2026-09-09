const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  cjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  map: "application/json; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  webmanifest: "application/manifest+json; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  ico: "image/x-icon",
  bmp: "image/bmp",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",
  wasm: "application/wasm",
  pdf: "application/pdf",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  zip: "application/zip",
};

export const DEFAULT_CONTENT_TYPE = "application/octet-stream";

export function contentTypeFor(filename: string): string {
  const name = String(filename ?? "");
  const dot = name.lastIndexOf(".");
  if (dot === -1 || dot === name.length - 1) return DEFAULT_CONTENT_TYPE;
  const ext = name.slice(dot + 1).toLowerCase();
  return MIME[ext] ?? DEFAULT_CONTENT_TYPE;
}

const HASHED = /(?:\.[0-9a-f]{8,}\.|-[0-9a-f]{8,}\.)/i;

/** True for build-output filenames with a content hash (safe to cache immutably). */
export function isHashedAsset(filename: string): boolean {
  const base = String(filename ?? "").split("/").pop() ?? "";
  return HASHED.test(base);
}
