import fs from "node:fs";
import path from "node:path";

/** Walk up from `start` until a directory containing pnpm-workspace.yaml is found. */
export function findRepoRoot(start: string = process.cwd()): string {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(start);
    dir = parent;
  }
}

let envLoaded = false;

/** Load repo-root .env without overriding already-set variables. */
export function loadEnv(): void {
  if (envLoaded) return;
  envLoaded = true;
  const envPath = path.join(findRepoRoot(), ".env");
  if (!fs.existsSync(envPath)) return;

  const before = new Set(Object.keys(process.env));
  const loadEnvFile = (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile;
  if (typeof loadEnvFile === "function") {
    try {
      // process.loadEnvFile overrides; restore anything that was already set.
      const snapshot = new Map<string, string | undefined>();
      for (const key of before) snapshot.set(key, process.env[key]);
      loadEnvFile.call(process, envPath);
      for (const [key, value] of snapshot) process.env[key] = value;
      return;
    } catch {
      // fall through to the manual parser
    }
  }
  parseEnvInto(fs.readFileSync(envPath, "utf8"), process.env as Record<string, string>);
}

function parseEnvInto(text: string, target: Record<string, string | undefined>): void {
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key || key in target) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }
    target[key] = value;
  }
}

function str(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function num(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  return value === "true" || value === "1" || value === "yes";
}

function list(name: string, fallback: string): string[] {
  return str(name, fallback)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export interface Config {
  nodeEnv: string;
  databaseUrl: string;
  storageDriver: "s3" | "fs";
  storageFsRoot: string;
  s3Endpoint: string;
  s3Bucket: string;
  s3AccessKey: string;
  s3SecretKey: string;
  s3Region: string;
  s3ForcePathStyle: boolean;
  controlUrl: string;
  sitesUrl: string;
  sessionSecret: string;
  authProvider: "mock" | "oidc";
  oidcIssuer: string;
  oidcClientId: string;
  oidcClientSecret: string;
  adminEmails: string[];
  defaultExpiryDays: number;
  expiredRetentionDays: number;
  cliTokenTtlDays: number;
  maxFiles: number;
  maxFileBytes: number;
  maxSiteBytes: number;
  maxArchiveBytes: number;
}

function buildConfig(): Config {
  loadEnv();
  const nodeEnv = str("NODE_ENV", "development");
  const sessionSecret = str("SESSION_SECRET", "change-me-32-bytes-minimum-please!");
  if (nodeEnv === "production" && sessionSecret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be at least 32 characters when NODE_ENV=production (got " +
        sessionSecret.length +
        ").",
    );
  }
  const storageDriver = str("STORAGE_DRIVER", "s3") === "fs" ? "fs" : "s3";
  const authProvider = str("AUTH_PROVIDER", "mock") === "oidc" ? "oidc" : "mock";
  const repoRoot = findRepoRoot();
  const fsRoot = str("STORAGE_FS_ROOT", ".data/storage");

  return {
    nodeEnv,
    databaseUrl: str("DATABASE_URL", "postgres://drop:drop@localhost:5440/drop"),
    storageDriver,
    storageFsRoot: path.isAbsolute(fsRoot) ? fsRoot : path.join(repoRoot, fsRoot),
    s3Endpoint: str("S3_ENDPOINT", "http://localhost:9100"),
    s3Bucket: str("S3_BUCKET", "drop-sites"),
    s3AccessKey: str("S3_ACCESS_KEY", "drop"),
    s3SecretKey: str("S3_SECRET_KEY", "dropdropdrop"),
    s3Region: str("S3_REGION", "us-east-1"),
    s3ForcePathStyle: bool("S3_FORCE_PATH_STYLE", true),
    controlUrl: str("CONTROL_URL", "http://localhost:3100").replace(/\/+$/, ""),
    sitesUrl: str("SITES_URL", "http://localhost:3101").replace(/\/+$/, ""),
    sessionSecret,
    authProvider,
    oidcIssuer: str("OIDC_ISSUER", ""),
    oidcClientId: str("OIDC_CLIENT_ID", ""),
    oidcClientSecret: str("OIDC_CLIENT_SECRET", ""),
    adminEmails: list("ADMIN_EMAILS", ""),
    defaultExpiryDays: num("DEFAULT_EXPIRY_DAYS", 30),
    expiredRetentionDays: num("EXPIRED_RETENTION_DAYS", 30),
    cliTokenTtlDays: num("CLI_TOKEN_TTL_DAYS", 90),
    maxFiles: num("MAX_FILES", 5000),
    maxFileBytes: num("MAX_FILE_BYTES", 26214400),
    maxSiteBytes: num("MAX_SITE_BYTES", 209715200),
    maxArchiveBytes: num("MAX_ARCHIVE_BYTES", 209715200),
  };
}

export const config: Config = buildConfig();
