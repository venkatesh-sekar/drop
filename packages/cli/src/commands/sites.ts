import { Api, type Site } from "../api.ts";
import type { ParsedArgs } from "../args.ts";
import { openInBrowser } from "../browser.ts";
import { CliError, UsageError } from "../errors.ts";
import { formatExpiry, formatRelative, table } from "../format.ts";
import { confirm, isInteractive, note, out } from "../io.ts";
import { normalizePath } from "../paths.ts";

export async function list(args: ParsedArgs, controlUrl: string): Promise<void> {
  const api = new Api(controlUrl);
  const { sites } = await api.request<{ sites: Site[] }>("/api/sites");

  if (args.json) {
    out(JSON.stringify({ sites }));
    return;
  }

  if (sites.length === 0) {
    out("No drops yet. Publish one: drop deploy ./dist");
    return;
  }

  out(
    table(
      ["PATH", "STATUS", "EXPIRES", "UPDATED", "URL"],
      sites.map((site) => [
        site.path,
        site.status === "active" ? "Live" : "Expired",
        formatExpiry(site.expires_at),
        formatRelative(site.last_deployed_at ?? site.updated_at),
        site.url,
      ]),
    ),
  );
}

function requirePath(args: ParsedArgs, command: string): string {
  const raw = args.positionals[0];
  if (raw === undefined) throw new UsageError(`drop ${command} needs a path.  Usage: drop ${command} <path>`);
  const path = normalizePath(raw);
  if (path === "") throw new CliError("invalid_path", `"${raw}" is not a valid path.`);
  return path;
}

export async function remove(args: ParsedArgs, controlUrl: string): Promise<void> {
  const path = requirePath(args, "delete");

  if (!args.yes && isInteractive()) {
    const ok = await confirm(`Delete ${path}? This frees the path for anyone. [y/N]`);
    if (!ok) throw new CliError("cancelled", "Cancelled.");
  }

  const api = new Api(controlUrl);
  await api.request<void>(`/api/sites/${encodeURIComponent(path)}`, { method: "DELETE" });

  if (args.json) {
    out(JSON.stringify({ deleted: true, path }));
    return;
  }
  out(`Deleted ${path}.`);
}

export async function open(args: ParsedArgs, controlUrl: string): Promise<void> {
  const path = requirePath(args, "open");
  const api = new Api(controlUrl);
  const { site } = await api.request<{ site: Site }>(`/api/sites/${encodeURIComponent(path)}`);

  if (args.json) {
    out(JSON.stringify({ url: site.url, path: site.path }));
    return;
  }
  note(`Opening ${site.url}`);
  openInBrowser(site.url);
}
