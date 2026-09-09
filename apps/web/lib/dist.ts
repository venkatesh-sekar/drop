import fs from "node:fs/promises"
import path from "node:path"
import { config, findRepoRoot } from "@drop/core"

/**
 * Files the control app hands out so nobody needs a checkout: the CLI and MCP
 * bundles (built by tsup into one file each), the agent skill, and the install
 * script. Read from the repo at request time so `pnpm dev` (tsup --watch) and
 * the Docker image behave the same.
 */

const repoRoot = findRepoRoot()

export interface InstallAsset {
  /** Path relative to the repo root. */
  file: string
  contentType: string
  /** What to run when the file is missing. */
  build: string
}

export const INSTALL_ASSETS: Record<string, InstallAsset> = {
  "drop.js": {
    file: "packages/cli/dist/drop.js",
    contentType: "text/javascript; charset=utf-8",
    build: "pnpm --filter @drop/cli build",
  },
  "drop-mcp.js": {
    file: "packages/mcp/dist/drop-mcp.js",
    contentType: "text/javascript; charset=utf-8",
    build: "pnpm --filter @drop/mcp build",
  },
  "SKILL.md": {
    file: "skills/drop/SKILL.md",
    contentType: "text/markdown; charset=utf-8",
    build: "restore skills/drop/SKILL.md",
  },
}

export async function readRepoFile(relative: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(repoRoot, relative))
  } catch {
    return null
  }
}

/** The install script with this Drop's URL baked in, so `drop login` needs no --url. */
export async function installScript(): Promise<string | null> {
  const template = await readRepoFile("apps/web/lib/install.sh")
  return template
    ? template.toString("utf8").replaceAll("__DROP_URL__", config.controlUrl)
    : null
}

/** The version the served CLI bundle reports, from its package.json. */
export async function cliVersion(): Promise<string | null> {
  const raw = await readRepoFile("packages/cli/package.json")
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw.toString("utf8")) as { version?: unknown }
    return typeof parsed.version === "string" ? parsed.version : null
  } catch {
    return null
  }
}

/** The one-line install command shown everywhere. */
export const installCommand = `curl -fsSL ${config.controlUrl}/install | sh`
