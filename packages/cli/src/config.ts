import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_CONTROL_URL = "http://localhost:3100";

export interface DropUser {
  id?: string;
  display_name?: string;
  email?: string;
  is_admin?: boolean;
  [key: string]: unknown;
}

export interface Credential {
  token: string;
  user?: DropUser;
  created_at?: string;
}

interface ConfigFile {
  url?: string;
}

export function configDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg && xdg.trim() !== "" ? xdg : join(homedir(), ".config");
  return join(base, "drop");
}

function configPath(): string {
  return join(configDir(), "config.json");
}

function credentialsPath(): string {
  return join(configDir(), "credentials.json");
}

function readJson<T>(file: string): T | undefined {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return undefined;
  }
}

function ensureDir(): string {
  const dir = configDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  try {
    chmodSync(dir, 0o700);
  } catch {
    /* best effort on platforms without POSIX modes */
  }
  return dir;
}

/** Trailing slashes are noise; one canonical spelling keeps credential keys stable. */
export function normalizeControlUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function readConfig(): ConfigFile {
  return readJson<ConfigFile>(configPath()) ?? {};
}

export function writeConfig(patch: ConfigFile): void {
  ensureDir();
  const next = { ...readConfig(), ...patch };
  writeFileSync(configPath(), JSON.stringify(next, null, 2) + "\n", { mode: 0o600 });
}

/** `--url` beats `DROP_URL` beats the config file beats localhost. */
export function resolveControlUrl(flagUrl?: string): string {
  const candidate =
    flagUrl ?? process.env.DROP_URL ?? readConfig().url ?? DEFAULT_CONTROL_URL;
  return normalizeControlUrl(candidate);
}

export function readCredentials(): Record<string, Credential> {
  return readJson<Record<string, Credential>>(credentialsPath()) ?? {};
}

function writeCredentials(all: Record<string, Credential>): void {
  ensureDir();
  const file = credentialsPath();
  writeFileSync(file, JSON.stringify(all, null, 2) + "\n", { mode: 0o600 });
  try {
    chmodSync(file, 0o600);
  } catch {
    /* best effort */
  }
}

export function getCredential(controlUrl: string): Credential | undefined {
  return readCredentials()[normalizeControlUrl(controlUrl)];
}

/** DROP_TOKEN wins so CI can run without a credentials file. */
export function getToken(controlUrl: string): string | undefined {
  const env = process.env.DROP_TOKEN;
  if (env && env.trim() !== "") return env.trim();
  return getCredential(controlUrl)?.token;
}

export function saveCredential(controlUrl: string, credential: Credential): void {
  const all = readCredentials();
  all[normalizeControlUrl(controlUrl)] = {
    ...credential,
    created_at: credential.created_at ?? new Date().toISOString(),
  };
  writeCredentials(all);
}

export function deleteCredential(controlUrl: string): boolean {
  const all = readCredentials();
  const key = normalizeControlUrl(controlUrl);
  if (!(key in all)) return false;
  delete all[key];
  writeCredentials(all);
  return true;
}
