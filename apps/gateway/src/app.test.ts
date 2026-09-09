import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import type { SiteLookup, ServingSite } from "./serve";
import type { Storage, StorageObject } from "@drop/core";

const encoder = new TextEncoder();

/** In-memory Storage: a plain map of key → body text. */
function fakeStorage(files: Record<string, string>): Storage {
  return {
    async put() {},
    async deletePrefix() {},
    async get(key: string): Promise<StorageObject | null> {
      const text = files[key];
      if (text === undefined) return null;
      const bytes = encoder.encode(text);
      return {
        size: bytes.byteLength,
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        }),
      };
    },
  };
}

const SITE: ServingSite = { id: "site-1", storage_prefix: "sites/site-1/deploy-1", spa: false };
const SPA_SITE: ServingSite = { id: "site-2", storage_prefix: "sites/site-2/deploy-1", spa: true };

const FILES = {
  "sites/site-1/deploy-1/index.html": "<h1>hello</h1>",
  "sites/site-1/deploy-1/style.css": "body{}",
  "sites/site-1/deploy-1/assets/app.a1b2c3d4.js": "console.log(1)",
  "sites/site-1/deploy-1/assets/logo.svg": "<svg/>",
  "sites/site-1/deploy-1/docs/index.html": "<h1>docs</h1>",
  "sites/site-2/deploy-1/index.html": "<h1>spa</h1>",
};

function app(overrides: { lookup?: SiteLookup; files?: Record<string, string> } = {}) {
  const lookup: SiteLookup =
    overrides.lookup ??
    (async (path) => (path === "site" ? SITE : path === "spa" ? SPA_SITE : null));
  return createApp({
    lookup,
    storage: fakeStorage(overrides.files ?? FILES),
    config: { controlUrl: "http://localhost:3100" },
    cacheTtlMs: 0,
  });
}

const get = (path: string, init?: RequestInit) =>
  app().request(new Request(`http://sites.test${path}`, init));

describe("gateway", () => {
  it("serves a health check without touching the database", async () => {
    const res = await app().request("http://sites.test/health", undefined, {});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("serves the root page with a link to the control app", async () => {
    const res = await get("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain("Sites published with Drop are served here.");
    expect(body).toContain("http://localhost:3100");
  });

  it("redirects /site to /site/ preserving the query string", async () => {
    const res = await get("/site?a=1");
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("/site/?a=1");
  });

  it("404s a bare path that is not a valid site path", async () => {
    const res = await get("/NOT_VALID");
    expect(res.status).toBe(404);
  });

  it("serves index.html for the site root", async () => {
    const res = await get("/site/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-cache");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("content-length")).toBe("14");
    expect(await res.text()).toBe("<h1>hello</h1>");
  });

  it("serves HEAD with headers and no body", async () => {
    const res = await get("/site/", { method: "HEAD" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await res.text()).toBe("");
  });

  it("types and caches a plain asset", async () => {
    const res = await get("/site/style.css");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/css; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
  });

  it("caches a hashed asset immutably", async () => {
    const res = await get("/site/assets/app.a1b2c3d4.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
  });

  it("types nested svg assets", async () => {
    const res = await get("/site/assets/logo.svg");
    expect(res.headers.get("content-type")).toBe("image/svg+xml");
  });

  it("redirects a directory to its trailing-slash URL", async () => {
    const res = await get("/site/docs");
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("/site/docs/");
    const followed = await get("/site/docs/");
    expect(followed.status).toBe(200);
    expect(await followed.text()).toBe("<h1>docs</h1>");
  });

  it("rejects path traversal", async () => {
    for (const path of ["/site/%2e%2e%2fetc", "/site//x", "/site/a%00b", "/site/a%5c..%5cb"]) {
      const res = await get(path);
      expect(res.status, path).toBe(404);
    }
  });

  it("never serves site content for a dot-dot URL", async () => {
    // WHATWG URL parsing collapses `..` and `%2e%2e` segments before routing, so these
    // never reach the site at all.
    expect((await get("/site/../etc")).headers.get("location")).toBe("/etc/");
    expect((await get("/site/%2e%2e/x")).headers.get("location")).toBe("/x/");
    expect((await get("/site/a/../../style.css")).status).toBe(404);
  });

  it("404s a missing file on a non-spa site", async () => {
    expect((await get("/site/nope.js")).status).toBe(404);
    expect((await get("/site/about")).status).toBe(404);
  });

  it("serves index.html for unknown routes on an spa site", async () => {
    const res = await get("/spa/about");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await res.text()).toBe("<h1>spa</h1>");
  });

  it("does not spa-fallback for asset-looking requests", async () => {
    const res = await get("/spa/missing.js");
    expect(res.status).toBe(404);
  });

  it("spa-falls back for extensioned requests that accept html", async () => {
    const res = await get("/spa/report.2024", { headers: { accept: "text/html" } });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("<h1>spa</h1>");
  });

  it("404s an unknown or expired site with the html page", async () => {
    const res = await get("/gone/");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain("isn");
    expect(body).toContain("http://localhost:3100");
  });

  it("405s other methods", async () => {
    for (const method of ["POST", "PUT", "DELETE"]) {
      const res = await get("/site/", { method });
      expect(res.status, method).toBe(405);
      expect(res.headers.get("allow")).toBe("GET, HEAD");
    }
  });

  it("502s when storage fails, without crashing", async () => {
    const broken = createApp({
      lookup: async () => SITE,
      storage: {
        async put() {},
        async deletePrefix() {},
        async get() {
          throw new Error("s3 is down");
        },
      },
      config: { controlUrl: "http://localhost:3100" },
      cacheTtlMs: 0,
    });
    const res = await broken.request("http://sites.test/site/");
    expect(res.status).toBe(502);
    expect(res.headers.get("content-type")).toContain("text/plain");
  });

  it("never sets cookies", async () => {
    const paths = ["/", "/health", "/site", "/site/", "/site/style.css", "/gone/", "/site/nope.js"];
    for (const path of paths) {
      const res = await get(path);
      expect(res.headers.get("set-cookie"), path).toBeNull();
    }
  });
});

describe("site lookup cache", () => {
  it("caches hits and misses for the ttl", async () => {
    let calls = 0;
    const cached = createApp({
      lookup: async () => {
        calls++;
        return null;
      },
      storage: fakeStorage({}),
      config: { controlUrl: "http://localhost:3100" },
    });
    await cached.request("http://sites.test/site/");
    await cached.request("http://sites.test/site/");
    await cached.request("http://sites.test/site/a.css");
    expect(calls).toBe(1);
  });
});
