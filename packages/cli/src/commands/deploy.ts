import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { Api, type Site } from "../api.ts";
import type { ParsedArgs } from "../args.ts";
import { CliError, UsageError } from "../errors.ts";
import { formatBytes, formatExpiry } from "../format.ts";
import { isInteractive, note, out, prompt } from "../io.ts";
import { isValidPath, normalizePath, RESERVED_PATHS, suggestPathFromFolder } from "../paths.ts";
import { collectFiles, zipFiles } from "../zip.ts";

interface DeployResponse {
  url: string;
  path: string;
  site: Site;
  warnings?: string[];
}

function pathError(candidate: string): CliError {
  if (RESERVED_PATHS.has(candidate)) {
    return new CliError("reserved_path", `"${candidate}" is reserved. Pick a different --path.`);
  }
  return new CliError(
    "invalid_path",
    `"${candidate}" is not a valid path. Use 1-64 lowercase letters, numbers and hyphens.`,
  );
}

async function resolveSitePath(args: ParsedArgs, folder: string): Promise<string> {
  if (args.path !== undefined) {
    const explicit = normalizePath(args.path);
    if (!isValidPath(explicit)) throw pathError(explicit || args.path);
    return explicit;
  }

  const suggestion = suggestPathFromFolder(folder);

  if (!isInteractive() || args.yes) {
    if (!isValidPath(suggestion)) {
      throw new CliError(
        "invalid_path",
        `Could not derive a path from ${folder}. Pass --path <name>.`,
      );
    }
    return suggestion;
  }

  for (;;) {
    const answer = await prompt(`Path [${suggestion}]: `);
    const candidate = normalizePath(answer === "" ? suggestion : answer);
    if (isValidPath(candidate)) return candidate;
    note(pathError(candidate || answer).message);
  }
}

export async function deploy(args: ParsedArgs, controlUrl: string): Promise<void> {
  const input = args.positionals[0];
  if (input === undefined) {
    throw new UsageError("drop deploy needs a folder.  Usage: drop deploy <folder> [--path <name>]");
  }

  const folder = resolve(input);
  if (!existsSync(folder)) throw new CliError("not_found", `No such folder: ${input}`);
  if (!statSync(folder).isDirectory()) throw new CliError("not_a_directory", `Not a folder: ${input}`);
  if (!existsSync(join(folder, "index.html"))) {
    throw new CliError(
      "missing_index",
      `No index.html in ${input}. Point drop at your build output (dist/, build/, out/).`,
    );
  }

  const sitePath = await resolveSitePath(args, folder);

  const files = collectFiles(folder);
  if (files.length === 0) throw new CliError("empty_folder", `${input} has no files to publish.`);
  const archive = zipFiles(files);
  const rawBytes = files.reduce((total, file) => total + file.bytes.byteLength, 0);

  note(`Publishing ${files.length} file${files.length === 1 ? "" : "s"} (${formatBytes(rawBytes)}) to ${sitePath}...`);

  const api = new Api(controlUrl);
  let result: DeployResponse;
  try {
    result = await api.request<DeployResponse>(`/api/sites/${encodeURIComponent(sitePath)}/deploy`, {
      method: "POST",
      body: () => {
        const form = new FormData();
        form.append(
          "archive",
          new Blob([archive as BlobPart], { type: "application/zip" }),
          "site.zip",
        );
        if (args.permanent) form.append("expiry", "never");
        if (args.spa) form.append("spa", "true");
        return form;
      },
    });
  } catch (error) {
    if (error instanceof CliError && error.code === "path_taken") {
      throw new CliError(
        "path_taken",
        `"${sitePath}" is owned by someone else. Pick a different --path.`,
      );
    }
    throw error;
  }

  const warnings = result.warnings ?? [];
  const expiresAt = result.site?.expires_at ?? null;

  if (args.json) {
    out(JSON.stringify({ url: result.url, path: result.path, expires_at: expiresAt, warnings }));
    return;
  }

  out("");
  out("Live:");
  out(result.url);
  out("");
  for (const warning of warnings) out(`Warning: ${warning}`);
  out(expiresAt === null ? "Permanent" : `Expires ${formatExpiry(expiresAt)}`);
}
