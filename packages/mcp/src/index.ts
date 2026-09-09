import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { runCli } from "./cli.ts";

const AUTH_HINT =
  "Drop is not authenticated on this machine. Ask the human to run `drop login` once in a terminal " +
  "(it opens their browser for SSO), then retry. Do not ask them for a token.";

function text(value: string, isError = false): CallToolResult {
  return { content: [{ type: "text", text: value }], isError };
}

function errorCode(data: unknown): string | undefined {
  if (data && typeof data === "object" && "error" in data) {
    const code = (data as { error?: unknown }).error;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

/** Run the CLI and turn its JSON (or lack of it) into an MCP tool result. */
async function call(args: string[]): Promise<CallToolResult> {
  const result = await runCli([...args, "--json", "--yes"]);

  if (errorCode(result.data) === "unauthenticated") {
    return text(AUTH_HINT, true);
  }

  if (result.data === undefined) {
    const detail = result.stderr.trim() || result.raw || `drop exited with code ${result.code}`;
    return text(`The drop CLI produced no JSON output.\n${detail}`, true);
  }

  return text(JSON.stringify(result.data, null, 2), !result.ok);
}

const server = new McpServer({ name: "drop", version: "0.0.1" });

server.registerTool(
  "drop_deploy",
  {
    title: "Publish a static site with Drop",
    description:
      "Publish a folder of already-built static files, or a single html file, and get back a " +
      "shareable URL. A folder needs index.html at its root - point this at build output " +
      "(dist/, build/, out/), not at source. For a one-page result (report.html, a chart, a " +
      "rendered notebook) pass the html file itself. Sites are served under /<path>/, so " +
      "every asset " +
      "reference in the HTML must be relative ('./assets/app.js', not '/assets/app.js'); for " +
      "Vite set base: './', for Next.js use output: 'export' with basePath/assetPrefix, for Astro " +
      "set base. Returns { url, path, expires_at, warnings } - give the url back to the user. " +
      "Sites expire in 30 days unless permanent is true. If the result says the path is owned by " +
      "someone else, retry with a different path.",
    inputSchema: {
      folder: z
        .string()
        .describe(
          "Path to the built site folder, or to a single html file, absolute or relative to " +
            "the working directory.",
        ),
      path: z
        .string()
        .optional()
        .describe(
          "URL path to publish under: lowercase letters, numbers and hyphens (e.g. 'route-optimizer'). " +
            "Defaults to a name derived from the folder.",
        ),
      permanent: z.boolean().optional().describe("Never expire. Default: expires in 30 days."),
      spa: z
        .boolean()
        .optional()
        .describe("Serve index.html for unknown routes (client-side routing)."),
    },
  },
  async ({ folder, path, permanent, spa }) => {
    const args = ["deploy", folder];
    if (path) args.push("--path", path);
    if (permanent) args.push("--permanent");
    if (spa) args.push("--spa");
    return await call(args);
  },
);

server.registerTool(
  "drop_list",
  {
    title: "List Drop sites",
    description:
      "List the static sites the signed-in user has published with Drop, with each site's path, " +
      "live URL, status and expiry. Use it to check whether a path is already yours before deploying.",
    inputSchema: {},
  },
  async () => await call(["list"]),
);

server.registerTool(
  "drop_delete",
  {
    title: "Delete a Drop site",
    description:
      "Delete a published site and free its path for anyone to claim. This is irreversible - " +
      "confirm with the user first.",
    inputSchema: {
      path: z.string().describe("The site path to delete, e.g. 'route-optimizer'."),
    },
  },
  async ({ path }) => await call(["delete", path]),
);

server.registerTool(
  "drop_whoami",
  {
    title: "Show the Drop identity",
    description:
      "Show which user the drop CLI is signed in as, and which Drop control URL it is pointed at. " +
      "Use it to check authentication before deploying.",
    inputSchema: {},
  },
  async () => await call(["whoami"]),
);

async function start(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

start().catch((error: unknown) => {
  process.stderr.write(
    `drop-mcp: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
