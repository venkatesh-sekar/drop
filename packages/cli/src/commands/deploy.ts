import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { Api, type Site } from "../api.ts";
import type { ParsedArgs } from "../args.ts";
import { CliError, UsageError } from "../errors.ts";
import { formatBytes, formatExpiry } from "../format.ts";
import { isInteractive, note, out, prompt } from "../io.ts";
import {
  isValidPath,
  normalizePath,
  RESERVED_PATHS,
  suggestPathFromFile,
  suggestPathFromFolder,
} from "../paths.ts";
import { collectFile, collectFiles, hasHomePage, zipFiles } from "../zip.ts";

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

async function resolveSitePath(args: ParsedArgs, source: string, isFile: boolean): Promise<string> {
  if (args.path !== undefined) {
    const explicit = normalizePath(args.path);
    if (!isValidPath(explicit)) throw pathError(explicit || args.path);
    return explicit;
  }

  const suggestion = isFile ? suggestPathFromFile(source) : suggestPathFromFolder(source);

  if (!isInteractive() || args.yes) {
    if (!isValidPath(suggestion)) {
      throw new CliError(
        "invalid_path",
        `Could not derive a path from ${source}. Pass --path <name>.`,
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
    throw new UsageError(
      "drop deploy needs a folder or a file.  Usage: drop deploy <folder|file> [--path <name>]",
    );
  }

  const source = resolve(input);
  if (!existsSync(source)) throw new CliError("not_found", `No such folder or file: ${input}`);
  const isFile = statSync(source).isFile();
  const isZip = isFile && /\.zip$/i.test(source);

  // Read and check the upload before asking for a path, so a hopeless one fails fast.
  let archive: Uint8Array;
  let summary: string;
  if (isZip) {
    archive = new Uint8Array(readFileSync(source));
    summary = `archive (${formatBytes(archive.byteLength)})`;
  } else {
    const files = isFile ? collectFile(source) : collectFiles(source);
    if (files.length === 0) throw new CliError("empty_folder", `${input} has no files to publish.`);
    if (!hasHomePage(files)) {
      throw new CliError(
        "missing_index",
        isFile
          ? `Only an html file can be published on its own; ${input} is not one. Put it in a folder with an index.html.`
          : `No index.html in ${input}. Point drop at your build output (dist/, build/, out/).`,
      );
    }
    archive = zipFiles(files);
    const rawBytes = files.reduce((total, file) => total + file.bytes.byteLength, 0);
    summary = `${files.length} file${files.length === 1 ? "" : "s"} (${formatBytes(rawBytes)})`;
  }

  const sitePath = await resolveSitePath(args, source, isFile);

  note(`Publishing ${summary} to ${sitePath}...`);

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
