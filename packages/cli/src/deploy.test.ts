import { createServer, type Server } from "node:http";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { strToU8, zipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { main } from "./main.ts";

interface Captured {
  authorization?: string;
  fields: Record<string, string>;
  archiveName?: string;
  archiveType?: string;
  archiveBytes?: number;
  url?: string;
}

let server: Server;
let baseUrl: string;
let captured: Captured;
let home: string;
let site: string;
const savedEnv = { ...process.env };

function startServer(handler: (captured: Captured) => { status: number; body: unknown }) {
  return new Promise<void>((resolve) => {
    server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        void (async () => {
          captured.url = req.url;
          captured.authorization = req.headers.authorization;
          const body = Buffer.concat(chunks);
          const contentType = req.headers["content-type"];
          if (contentType?.startsWith("multipart/form-data")) {
            const form = await new Response(body, {
              headers: { "content-type": contentType },
            }).formData();
            for (const [key, value] of form.entries()) {
              if (typeof value === "string") {
                captured.fields[key] = value;
              } else {
                captured.archiveName = value.name;
                captured.archiveType = value.type;
                captured.archiveBytes = value.size;
              }
            }
          }
          const result = handler(captured);
          res.writeHead(result.status, { "content-type": "application/json" });
          res.end(JSON.stringify(result.body));
        })();
      });
    });
    server.listen(0, "127.0.0.1", () => {
      baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      resolve();
    });
  });
}

/** Collect everything the CLI writes to stdout while it runs. */
async function run(argv: string[]): Promise<{ code: number; stdout: string }> {
  const chunks: string[] = [];
  const original = process.stdout.write.bind(process.stdout);
  (process.stdout as { write: unknown }).write = (chunk: string | Uint8Array) => {
    chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString());
    return true;
  };
  try {
    const code = await main(argv);
    return { code, stdout: chunks.join("") };
  } finally {
    (process.stdout as { write: unknown }).write = original;
  }
}

beforeEach(() => {
  captured = { fields: {} };
  home = mkdtempSync(join(tmpdir(), "drop-cli-home-"));
  site = mkdtempSync(join(tmpdir(), "route-optimizer-"));
  mkdirSync(join(site, "assets"));
  mkdirSync(join(site, "node_modules"));
  writeFileSync(join(site, "index.html"), "<!doctype html><title>hi</title>");
  writeFileSync(join(site, "assets", "app.js"), "console.log(1)");
  writeFileSync(join(site, ".DS_Store"), "junk");
  writeFileSync(join(site, "node_modules", "x.js"), "junk");
  process.env.XDG_CONFIG_HOME = home;
  process.env.DROP_TOKEN = "drop_test_token";
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(home, { recursive: true, force: true });
  rmSync(site, { recursive: true, force: true });
  process.env = { ...savedEnv };
});

describe("drop deploy", () => {
  it("uploads a zip and prints one JSON line", async () => {
    await startServer(() => ({
      status: 200,
      body: {
        url: "http://localhost:3101/route-optimizer/",
        path: "route-optimizer",
        site: { expires_at: "2099-01-01T00:00:00.000Z" },
        warnings: ["Absolute asset paths will break under /route-optimizer/."],
      },
    }));

    const { code, stdout } = await run([
      "deploy",
      site,
      "--path",
      "route-optimizer",
      "--permanent",
      "--spa",
      "--json",
      "--url",
      baseUrl,
    ]);

    expect(code).toBe(0);
    expect(captured.url).toBe("/api/sites/route-optimizer/deploy");
    expect(captured.authorization).toBe("Bearer drop_test_token");
    expect(captured.archiveName).toBe("site.zip");
    expect(captured.archiveType).toBe("application/zip");
    expect(captured.archiveBytes).toBeGreaterThan(0);
    expect(captured.fields).toEqual({ expiry: "never", spa: "true" });

    const lines = stdout.trimEnd().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toEqual({
      url: "http://localhost:3101/route-optimizer/",
      path: "route-optimizer",
      expires_at: "2099-01-01T00:00:00.000Z",
      warnings: ["Absolute asset paths will break under /route-optimizer/."],
    });
  });

  it("sends --expires as a day expiry", async () => {
    await startServer(() => ({
      status: 200,
      body: { url: `${baseUrl}/x/`, path: "x", site: { expires_at: "2099-01-01T00:00:00.000Z" }, warnings: [] },
    }));
    const { code } = await run(["deploy", site, "--path", "x", "--expires", "60", "--json", "--url", baseUrl]);
    expect(code).toBe(0);
    expect(captured.fields).toEqual({ expiry: "60d" });
  });

  it("omits expiry and spa fields by default", async () => {
    await startServer(() => ({
      status: 200,
      body: { url: `${baseUrl}/x/`, path: "x", site: { expires_at: null }, warnings: [] },
    }));
    const { code } = await run(["deploy", site, "--path", "x", "--json", "--url", baseUrl]);
    expect(code).toBe(0);
    expect(captured.fields).toEqual({});
  });

  it("reports an API error as JSON on stdout and exits 1", async () => {
    await startServer(() => ({
      status: 409,
      body: { error: "path_taken", message: "Someone else owns this path." },
    }));

    const { code, stdout } = await run(["deploy", site, "--path", "taken", "--json", "--url", baseUrl]);
    expect(code).toBe(1);
    expect(JSON.parse(stdout.trim())).toEqual({
      error: "path_taken",
      message: '"taken" is owned by someone else. Pick a different --path.',
    });
  });

  it("refuses a folder without index.html", async () => {
    await startServer(() => ({ status: 200, body: {} }));
    const empty = mkdtempSync(join(tmpdir(), "drop-empty-"));
    writeFileSync(join(empty, "main.tsx"), "");
    writeFileSync(join(empty, "style.css"), "");
    const { code, stdout } = await run(["deploy", empty, "--path", "x", "--json", "--url", baseUrl]);
    rmSync(empty, { recursive: true, force: true });
    expect(code).toBe(1);
    expect(JSON.parse(stdout.trim()).error).toBe("missing_index");
    expect(captured.url).toBeUndefined();
  });

  it("refuses a folder whose only html file is not index.html", async () => {
    await startServer(() => ({ status: 200, body: {} }));
    const folder = mkdtempSync(join(tmpdir(), "drop-chart-"));
    writeFileSync(join(folder, "chart.html"), "<h1>c</h1>");
    writeFileSync(join(folder, "chart.js"), "");
    const { code, stdout } = await run(["deploy", folder, "--path", "x", "--json", "--url", baseUrl]);
    rmSync(folder, { recursive: true, force: true });
    expect(code).toBe(1);
    expect(JSON.parse(stdout.trim()).error).toBe("missing_index");
    expect(captured.url).toBeUndefined();
  });

  it("publishes a single file and names the path after it", async () => {
    await startServer(() => ({
      status: 200,
      body: { url: `${baseUrl}/q3-report/`, path: "q3-report", site: { expires_at: null }, warnings: [] },
    }));
    const folder = mkdtempSync(join(tmpdir(), "drop-file-"));
    const file = join(folder, "Q3 Report.html");
    writeFileSync(file, "<h1>q3</h1>");
    const { code, stdout } = await run(["deploy", file, "--json", "--yes", "--url", baseUrl]);
    rmSync(folder, { recursive: true, force: true });
    expect(code).toBe(0);
    expect(captured.url).toBe("/api/sites/q3-report/deploy");
    expect(captured.archiveBytes).toBeGreaterThan(0);
    expect(JSON.parse(stdout.trim()).path).toBe("q3-report");
  });

  it("sends a .zip as the archive itself", async () => {
    await startServer(() => ({
      status: 200,
      body: { url: `${baseUrl}/launch/`, path: "launch", site: { expires_at: null }, warnings: [] },
    }));
    const folder = mkdtempSync(join(tmpdir(), "drop-zip-"));
    const file = join(folder, "launch.zip");
    const bytes = zipSync({ "index.html": strToU8("<h1>hi</h1>") });
    writeFileSync(file, bytes);
    const { code } = await run(["deploy", file, "--json", "--yes", "--url", baseUrl]);
    rmSync(folder, { recursive: true, force: true });
    expect(code).toBe(0);
    expect(captured.url).toBe("/api/sites/launch/deploy");
    expect(captured.archiveBytes).toBe(bytes.byteLength);
  });

  it("refuses a single non-html file", async () => {
    await startServer(() => ({ status: 200, body: {} }));
    const folder = mkdtempSync(join(tmpdir(), "drop-pdf-"));
    const file = join(folder, "notes.pdf");
    writeFileSync(file, "%PDF-1.4");
    const { code, stdout } = await run(["deploy", file, "--json", "--yes", "--url", baseUrl]);
    rmSync(folder, { recursive: true, force: true });
    expect(code).toBe(1);
    const body = JSON.parse(stdout.trim());
    expect(body.error).toBe("missing_index");
    expect(body.message).toContain("html");
    expect(captured.url).toBeUndefined();
  });

  it("exits with unauthenticated JSON when non-interactive and tokenless", async () => {
    await startServer(() => ({ status: 200, body: {} }));
    delete process.env.DROP_TOKEN;
    const { code, stdout } = await run(["deploy", site, "--path", "x", "--json", "--url", baseUrl]);
    expect(code).toBe(1);
    expect(JSON.parse(stdout.trim())).toEqual({
      error: "unauthenticated",
      message: "Run `drop login` in a terminal first.",
    });
  });
});
