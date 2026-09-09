import { describe, expect, it } from "vitest";
import { contentTypeFor, DEFAULT_CONTENT_TYPE, isHashedAsset } from "./mime";

describe("contentTypeFor", () => {
  const cases: [string, string][] = [
    ["index.html", "text/html; charset=utf-8"],
    ["style.css", "text/css; charset=utf-8"],
    ["app.js", "text/javascript; charset=utf-8"],
    ["mod.mjs", "text/javascript; charset=utf-8"],
    ["data.json", "application/json; charset=utf-8"],
    ["feed.xml", "application/xml; charset=utf-8"],
    ["site.webmanifest", "application/manifest+json; charset=utf-8"],
    ["logo.svg", "image/svg+xml"],
    ["a.png", "image/png"],
    ["a.jpg", "image/jpeg"],
    ["a.jpeg", "image/jpeg"],
    ["a.webp", "image/webp"],
    ["a.avif", "image/avif"],
    ["a.gif", "image/gif"],
    ["favicon.ico", "image/x-icon"],
    ["f.woff", "font/woff"],
    ["f.woff2", "font/woff2"],
    ["f.ttf", "font/ttf"],
    ["f.otf", "font/otf"],
    ["f.eot", "application/vnd.ms-fontobject"],
    ["m.wasm", "application/wasm"],
    ["readme.txt", "text/plain; charset=utf-8"],
    ["readme.md", "text/markdown; charset=utf-8"],
    ["rows.csv", "text/csv; charset=utf-8"],
    ["doc.pdf", "application/pdf"],
    ["clip.mp4", "video/mp4"],
    ["clip.webm", "video/webm"],
    ["song.mp3", "audio/mpeg"],
  ];

  it.each(cases)("%s → %s", (name, expected) => {
    expect(contentTypeFor(name)).toBe(expected);
  });

  it("is case insensitive and handles paths", () => {
    expect(contentTypeFor("assets/LOGO.SVG")).toBe("image/svg+xml");
  });

  it("falls back to octet-stream", () => {
    expect(contentTypeFor("LICENSE")).toBe(DEFAULT_CONTENT_TYPE);
    expect(contentTypeFor("weird.qqq")).toBe(DEFAULT_CONTENT_TYPE);
    expect(contentTypeFor("trailing.")).toBe(DEFAULT_CONTENT_TYPE);
  });
});

describe("isHashedAsset", () => {
  it("detects content hashes", () => {
    expect(isHashedAsset("app.4f3c2b1a.js")).toBe(true);
    expect(isHashedAsset("assets/index-a1b2c3d4.css")).toBe(true);
    expect(isHashedAsset("index-0f1e2d3c4b5a.js")).toBe(true);
  });

  it("ignores plain names", () => {
    expect(isHashedAsset("app.js")).toBe(false);
    expect(isHashedAsset("index.html")).toBe(false);
    expect(isHashedAsset("v1.2.3.js")).toBe(false);
  });
});
