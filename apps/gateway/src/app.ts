import { Hono } from "hono";
import type { Context } from "hono";
import {
  DEFAULT_CONTENT_TYPE,
  contentTypeFor,
  isHashedAsset,
  isValidPath,
  type Storage,
  type StorageObject,
} from "@drop/core";
import { notFoundPage, rootPage } from "./pages";
import { cachedLookup, hasExtension, resolveRelative, type SiteLookup } from "./serve";

export interface GatewayConfig {
  controlUrl: string;
}

export interface CreateAppOptions {
  lookup: SiteLookup;
  storage: Storage;
  config: GatewayConfig;
  /** Site-lookup cache TTL. 0 disables caching (tests). */
  cacheTtlMs?: number;
}

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
} as const;

function cacheControlFor(rel: string): string {
  if (/\.html?$/i.test(rel)) return "no-cache";
  if (isHashedAsset(rel)) return "public, max-age=31536000, immutable";
  return "public, max-age=300";
}

/**
 * The raw request target, before WHATWG URL parsing collapses `.` / `..` segments.
 * Only available on the Node adapter; null elsewhere (tests, other runtimes).
 */
function rawPathname(c: Context): string | null {
  const incoming = (c.env as { incoming?: { url?: string } } | undefined)?.incoming;
  const url = incoming?.url;
  if (typeof url !== "string" || !url.startsWith("/")) return null;
  const q = url.indexOf("?");
  return q === -1 ? url : url.slice(0, q);
}

/** True for a raw target containing traversal, empty segments or escaped separators. */
function looksUnsafe(rawPath: string | null): boolean {
  if (rawPath === null) return false;
  const segments = rawPath.split("/").slice(1);
  if (segments[segments.length - 1] === "") segments.pop(); // trailing slash is fine
  return segments.some((segment) => {
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return true;
    }
    return (
      decoded === "" || decoded === "." || decoded === ".." || decoded.includes("\\") ||
      decoded.includes("/")
    );
  });
}

function htmlResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", ...SECURITY_HEADERS },
  });
}

export function createApp(options: CreateAppOptions) {
  const { storage, config } = options;
  const lookup =
    options.cacheTtlMs === 0 ? options.lookup : cachedLookup(options.lookup, options.cacheTtlMs);
  const app = new Hono();

  const notFound = (c: Context) => {
    const body = notFoundPage(config.controlUrl);
    return c.req.method === "HEAD"
      ? new Response(null, {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8", ...SECURITY_HEADERS },
        })
      : htmlResponse(body, 404);
  };

  function respond(c: Context, object: StorageObject, rel: string): Response {
    const objectType = object.contentType?.trim();
    const contentType =
      objectType && objectType !== DEFAULT_CONTENT_TYPE ? objectType : contentTypeFor(rel);
    const headers = new Headers({
      "Content-Type": contentType,
      "Content-Length": String(object.size),
      "Cache-Control": cacheControlFor(rel),
      ...SECURITY_HEADERS,
    });
    if (c.req.method === "HEAD") {
      void object.body.cancel().catch(() => {});
      return new Response(null, { status: 200, headers });
    }
    return new Response(object.body, { status: 200, headers });
  }

  app.on(["GET", "HEAD"], "/health", (c) => c.json({ ok: true }));

  app.on(["GET", "HEAD"], "/", (c) =>
    c.req.method === "HEAD"
      ? new Response(null, {
          headers: { "Content-Type": "text/html; charset=utf-8", ...SECURITY_HEADERS },
        })
      : htmlResponse(rootPage(config.controlUrl), 200),
  );

  // /<path> → /<path>/ so relative asset URLs inside the site resolve.
  app.on(["GET", "HEAD"], "/:sitePath", (c) => {
    if (looksUnsafe(rawPathname(c))) return notFound(c);
    const url = new URL(c.req.url);
    const sitePath = url.pathname.slice(1);
    if (!isValidPath(sitePath)) return notFound(c);
    return new Response(null, {
      status: 301,
      headers: { Location: `/${sitePath}/${url.search}`, ...SECURITY_HEADERS },
    });
  });

  app.on(["GET", "HEAD"], "/:sitePath/*", async (c) => {
    if (looksUnsafe(rawPathname(c))) return notFound(c);
    const url = new URL(c.req.url);
    const pathname = url.pathname;
    const sitePath = pathname.slice(1, pathname.indexOf("/", 1));
    if (!isValidPath(sitePath)) return notFound(c);
    const rest = pathname.slice(sitePath.length + 2);

    const rel = resolveRelative(rest);
    if (rel === null) return notFound(c);

    try {
      const site = await lookup(sitePath);
      if (!site) return notFound(c);
      const prefix = site.storage_prefix.replace(/\/+$/, "");

      const object = await storage.get(`${prefix}/${rel}`);
      if (object) return respond(c, object, rel);

      // Extensionless request that is really a directory: point the browser at the
      // trailing-slash URL so the page's relative assets resolve.
      if (!hasExtension(rel)) {
        const dirIndex = await storage.get(`${prefix}/${rel}/index.html`);
        if (dirIndex) {
          void dirIndex.body.cancel().catch(() => {});
          return new Response(null, {
            status: 301,
            headers: { Location: `/${sitePath}/${rel}/${url.search}`, ...SECURITY_HEADERS },
          });
        }
      }

      const wantsHtml = (c.req.header("accept") ?? "").includes("text/html");
      if (site.spa && (!hasExtension(rel) || wantsHtml)) {
        const fallback = await storage.get(`${prefix}/index.html`);
        if (fallback) return respond(c, fallback, "index.html");
      }

      return notFound(c);
    } catch (err) {
      console.error(
        `gateway error path=${sitePath} rel=${rel}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return new Response("Bad gateway\n", {
        status: 502,
        headers: { "Content-Type": "text/plain; charset=utf-8", ...SECURITY_HEADERS },
      });
    }
  });

  app.notFound(notFound);

  app.all("*", (c) => {
    if (c.req.method === "GET" || c.req.method === "HEAD") return notFound(c);
    return new Response("Method not allowed\n", {
      status: 405,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        Allow: "GET, HEAD",
        ...SECURITY_HEADERS,
      },
    });
  });

  return app;
}
