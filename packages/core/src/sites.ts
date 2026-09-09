import { randomUUID } from "node:crypto";
import type { Config } from "./config";
import { config as defaultConfig } from "./config";
import type { Sql } from "./db";
import { sql as defaultSql } from "./db";
import { type Expiry, expiresAtFor } from "./expiry";
import { contentTypeFor } from "./mime";
import { validatePath } from "./paths";
import { putMany, type Storage, type UploadFile } from "./storage/index";

export type SiteErrorCode =
  | "invalid_path"
  | "reserved_path"
  | "path_taken"
  | "not_found"
  | "empty_deploy";

export class SiteError extends Error {
  readonly code: SiteErrorCode;
  constructor(code: SiteErrorCode, message?: string) {
    super(message ?? defaultSiteMessage(code));
    this.name = "SiteError";
    this.code = code;
  }
}

function defaultSiteMessage(code: SiteErrorCode): string {
  switch (code) {
    case "path_taken":
      return "That path is already owned by someone else. Pick a different one.";
    case "not_found":
      return "No site found at that path.";
    case "empty_deploy":
      return "A deployment needs at least one file.";
    default:
      return "Invalid path.";
  }
}

export interface SiteRow {
  id: string;
  path: string;
  owner_user_id: string;
  storage_prefix: string | null;
  status: "active" | "expired";
  spa: boolean;
  expires_at: Date | null;
  size_bytes: string | number;
  file_count: number;
  created_at: Date;
  updated_at: Date;
  last_deployed_at: Date | null;
}

export interface SiteJson {
  id: string;
  path: string;
  url: string;
  status: "active" | "expired";
  spa: boolean;
  expires_at: string | null;
  size_bytes: number;
  file_count: number;
  created_at: string;
  updated_at: string;
  last_deployed_at: string | null;
}

export function toSiteJson(row: SiteRow, sitesUrl: string = defaultConfig.sitesUrl): SiteJson {
  const base = sitesUrl.replace(/\/+$/, "");
  return {
    id: row.id,
    path: row.path,
    url: `${base}/${row.path}/`,
    status: row.status,
    spa: row.spa,
    expires_at: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    size_bytes: Number(row.size_bytes ?? 0),
    file_count: row.file_count ?? 0,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
    last_deployed_at: row.last_deployed_at
      ? new Date(row.last_deployed_at).toISOString()
      : null,
  };
}

/** What a new site gets when the deploy names no expiry. */
export function defaultExpiry(config: Config = defaultConfig): Expiry {
  return `${config.defaultExpiryDays}d`;
}

export async function findSiteByPath(
  path: string,
  db: Sql = defaultSql,
): Promise<SiteRow | null> {
  const rows = await db<SiteRow[]>`select * from sites where path = ${path}`;
  return rows[0] ?? null;
}

export interface ServingSite {
  id: string;
  storage_prefix: string;
  spa: boolean;
}

/** Lookup used by the gateway: active, unexpired and with content. */
export async function findActiveSiteForServing(
  path: string,
  db: Sql = defaultSql,
): Promise<ServingSite | null> {
  const rows = await db<ServingSite[]>`
    select id, storage_prefix, spa
    from sites
    where path = ${path}
      and status = 'active'
      and storage_prefix is not null
      and (expires_at is null or expires_at > now())
  `;
  return rows[0] ?? null;
}

export async function listSitesForUser(
  userId: string,
  db: Sql = defaultSql,
): Promise<SiteRow[]> {
  return db<SiteRow[]>`
    select * from sites
    where owner_user_id = ${userId}
    order by coalesce(last_deployed_at, created_at) desc
  `;
}

export interface DeploySiteInput {
  path: string;
  userId: string;
  files: UploadFile[];
  expiry?: Expiry;
  spa?: boolean;
  storage: Storage;
  config?: Config;
  warnings?: string[];
  db?: Sql;
}

export interface DeploySiteResult {
  site: SiteRow;
  warnings: string[];
}

/**
 * Upload a deployment under a fresh prefix, then switch the site row over to it in one
 * statement. Readers never observe a half-uploaded site; a failed upload never leaves an
 * active site pointing at a missing prefix.
 */
export async function deploySite(input: DeploySiteInput): Promise<DeploySiteResult> {
  const config = input.config ?? defaultConfig;
  const db = input.db ?? defaultSql;
  const warnings = [...(input.warnings ?? [])];

  const validated = validatePath(input.path);
  if (!validated.ok) throw new SiteError(validated.error, validated.message);
  const path = validated.path;

  if (input.files.length === 0) throw new SiteError("empty_deploy");

  const existing = await findSiteByPath(path, db);
  if (existing && existing.owner_user_id !== input.userId) {
    throw new SiteError("path_taken");
  }

  const siteId = existing?.id ?? randomUUID();
  const deployId = randomUUID();
  const prefix = `sites/${siteId}/${deployId}`;
  const oldPrefix = existing?.storage_prefix ?? null;

  const sizeBytes = await putMany(input.storage, input.files, prefix, contentTypeFor);
  const fileCount = input.files.length;

  let site: SiteRow;
  if (existing) {
    const expiresAt =
      input.expiry === undefined ? existing.expires_at : expiresAtFor(input.expiry);
    const spa = input.spa === undefined ? existing.spa : input.spa;
    const rows = await db<SiteRow[]>`
      update sites set
        storage_prefix = ${prefix},
        status = 'active',
        spa = ${spa},
        expires_at = ${expiresAt},
        size_bytes = ${sizeBytes},
        file_count = ${fileCount},
        updated_at = now(),
        last_deployed_at = now()
      where id = ${existing.id}
      returning *
    `;
    site = rows[0]!;
  } else {
    const expiresAt = expiresAtFor(input.expiry ?? defaultExpiry(config));
    try {
      const rows = await db<SiteRow[]>`
        insert into sites (
          id, path, owner_user_id, storage_prefix, status, spa,
          expires_at, size_bytes, file_count, last_deployed_at
        ) values (
          ${siteId}, ${path}, ${input.userId}, ${prefix}, 'active', ${input.spa ?? false},
          ${expiresAt}, ${sizeBytes}, ${fileCount}, now()
        )
        returning *
      `;
      site = rows[0]!;
    } catch (err) {
      // Lost a race for the path, or the insert failed: don't leave orphaned objects.
      await input.storage.deletePrefix(prefix).catch(() => {});
      if (isUniqueViolation(err)) throw new SiteError("path_taken");
      throw err;
    }
  }

  if (oldPrefix && oldPrefix !== prefix) {
    await input.storage.deletePrefix(oldPrefix).catch(() => {});
  }

  return { site, warnings };
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === "23505";
}

export interface UpdateSiteInput {
  expiry?: Expiry;
  spa?: boolean;
}

export async function updateSite(
  path: string,
  userId: string,
  changes: UpdateSiteInput,
  db: Sql = defaultSql,
): Promise<SiteRow> {
  const site = await findSiteByPath(path, db);
  if (!site || site.owner_user_id !== userId) throw new SiteError("not_found");

  const expiresAt = changes.expiry === undefined ? site.expires_at : expiresAtFor(changes.expiry);
  const spa = changes.spa === undefined ? site.spa : changes.spa;
  // Restoring an expiry in the future reactivates an expired site that still has content.
  const status =
    site.status === "expired" &&
    site.storage_prefix &&
    (expiresAt === null || new Date(expiresAt).getTime() > Date.now())
      ? "active"
      : site.status;

  const rows = await db<SiteRow[]>`
    update sites set
      expires_at = ${expiresAt},
      spa = ${spa},
      status = ${status},
      updated_at = now()
    where id = ${site.id}
    returning *
  `;
  return rows[0]!;
}

/** Delete storage first, then the row — a failed storage delete never orphans the row. */
export async function deleteSite(
  siteId: string,
  storage: Storage,
  db: Sql = defaultSql,
): Promise<void> {
  const rows = await db<{ storage_prefix: string | null }[]>`
    select storage_prefix from sites where id = ${siteId}
  `;
  const row = rows[0];
  if (!row) throw new SiteError("not_found");
  if (row.storage_prefix) {
    await storage.deletePrefix(row.storage_prefix);
  }
  await db`delete from sites where id = ${siteId}`;
}

export interface AdminSiteRow extends SiteRow {
  owner: { id: string; display_name: string; email: string };
}

export async function adminSearchSites(
  q: string,
  db: Sql = defaultSql,
): Promise<AdminSiteRow[]> {
  const term = `%${(q ?? "").trim().toLowerCase()}%`;
  const rows = await db<(SiteRow & {
    owner_id: string;
    owner_display_name: string;
    owner_email: string;
  })[]>`
    select s.*, u.id as owner_id, u.display_name as owner_display_name, u.email as owner_email
    from sites s
    join users u on u.id = s.owner_user_id
    where lower(s.path) like ${term} or lower(u.email) like ${term} or lower(u.display_name) like ${term}
    order by coalesce(s.last_deployed_at, s.created_at) desc
    limit 200
  `;
  return rows.map((r) => ({
    ...(r as unknown as SiteRow),
    owner: { id: r.owner_id, display_name: r.owner_display_name, email: r.owner_email },
  }));
}

export async function adminExpireSite(path: string, db: Sql = defaultSql): Promise<SiteRow> {
  const rows = await db<SiteRow[]>`
    update sites
    set status = 'expired', expires_at = now(), updated_at = now()
    where path = ${path}
    returning *
  `;
  const row = rows[0];
  if (!row) throw new SiteError("not_found");
  return row;
}
