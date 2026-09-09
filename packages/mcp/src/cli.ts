import { execFile } from "node:child_process";
import { accessSync, constants, existsSync } from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface CliResult {
  ok: boolean;
  /** Parsed JSON from the CLI's stdout, when it produced any. */
  data: unknown;
  code: number;
  stderr: string;
  raw: string;
}

function isExecutable(file: string): boolean {
  try {
    accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function onPath(name: string): string | undefined {
  const suffixes = process.platform === "win32" ? [".cmd", ".exe", ".bat", ""] : [""];
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (dir === "") continue;
    for (const suffix of suffixes) {
      const candidate = join(dir, name + suffix);
      if (existsSync(candidate) && isExecutable(candidate)) return candidate;
    }
  }
  return undefined;
}

/** DROP_CLI beats `drop` on PATH beats the drop.js installed next to this file beats the workspace build. */
export function resolveCliCommand(): { command: string; prefix: string[] } {
  const explicit = process.env.DROP_CLI;
  if (explicit && explicit.trim() !== "") return asCommand(explicit.trim());

  const found = onPath("drop");
  if (found) return asCommand(found);

  const here = dirname(fileURLToPath(import.meta.url));
  // `curl | sh` installs drop.js and drop-mcp.js side by side; a workspace build has them in sibling packages.
  const installed = resolve(here, "drop.js");
  if (existsSync(installed)) return asCommand(installed);
  return asCommand(resolve(here, "../../cli/dist/drop.js"));
}

function asCommand(target: string): { command: string; prefix: string[] } {
  // A .js file is not self-executing on every platform: run it under this Node.
  return target.endsWith(".js")
    ? { command: process.execPath, prefix: [target] }
    : { command: target, prefix: [] };
}

/** Run the CLI with --json and parse the single JSON line it prints. */
export async function runCli(args: string[]): Promise<CliResult> {
  const { command, prefix } = resolveCliCommand();
  const argv = [...prefix, ...args];

  return await new Promise<CliResult>((resolvePromise) => {
    execFile(
      command,
      argv,
      { env: process.env, maxBuffer: 16 * 1024 * 1024, windowsHide: true },
      (error, stdout, stderr) => {
        const code =
          error && typeof (error as { code?: unknown }).code === "number"
            ? ((error as { code: number }).code)
            : error
              ? 1
              : 0;
        const raw = stdout.trim();
        let data: unknown = undefined;
        const lastLine = raw.split("\n").filter((line) => line.trim() !== "").pop();
        if (lastLine) {
          try {
            data = JSON.parse(lastLine);
          } catch {
            data = undefined;
          }
        }
        if (error && data === undefined && !existsSync(command) && prefix.length === 0) {
          resolvePromise({
            ok: false,
            data: {
              error: "cli_not_found",
              message: `Could not run the drop CLI (${command}). Install it, or set DROP_CLI to its path.`,
            },
            code: 127,
            stderr,
            raw,
          });
          return;
        }
        resolvePromise({ ok: code === 0, data, code, stderr, raw });
      },
    );
  });
}
