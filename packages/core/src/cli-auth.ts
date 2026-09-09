import { createHash, randomBytes, randomInt } from "node:crypto";
import type { Config } from "./config";
import { config as defaultConfig } from "./config";
import type { Sql } from "./db";
import { sql as defaultSql } from "./db";
import type { User } from "./users";

/** Unambiguous: no 0/O/1/I/L. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_TTL_MS = 10 * 60 * 1000;
export const CLI_TOKEN_PREFIX = "drop_";

export type CliAuthStatus = "pending" | "approved" | "denied";

export interface CliAuthRequestRow {
  id: string;
  code: string;
  status: CliAuthStatus;
  user_id: string | null;
  token_hash: string | null;
  token: string | null;
  hostname: string | null;
  created_at: Date;
  expires_at: Date;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function generateAuthCode(): string {
  let out = "";
  for (let i = 0; i < 8; i++) {
    if (i === 4) out += "-";
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

export function generateCliToken(): string {
  return CLI_TOKEN_PREFIX + randomBytes(36).toString("base64url").slice(0, 48);
}

export async function createCliAuthRequest(
  hostname?: string,
  db: Sql = defaultSql,
): Promise<{ code: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateAuthCode();
    try {
      await db`
        insert into cli_auth_requests (code, status, hostname, expires_at)
        values (${code}, 'pending', ${hostname ?? null}, ${expiresAt})
      `;
      return { code, expiresAt };
    } catch (err) {
      if ((err as { code?: string })?.code !== "23505") throw err;
    }
  }
  throw new Error("Could not allocate a CLI auth code.");
}

export async function getCliAuthRequest(
  code: string,
  db: Sql = defaultSql,
): Promise<CliAuthRequestRow | null> {
  const rows = await db<CliAuthRequestRow[]>`
    select * from cli_auth_requests where code = ${normalizeCode(code)}
  `;
  return rows[0] ?? null;
}

function normalizeCode(code: string): string {
  return String(code ?? "").trim().toUpperCase();
}

/** Approve a pending request: mints a CLI token and parks the plaintext for one poll. */
export async function approveCliAuthRequest(
  code: string,
  userId: string,
  config: Config = defaultConfig,
  db: Sql = defaultSql,
): Promise<{ ok: true } | { ok: false; error: "not_found" | "expired" | "already_used" }> {
  const request = await getCliAuthRequest(code, db);
  if (!request) return { ok: false, error: "not_found" };
  if (request.status !== "pending") return { ok: false, error: "already_used" };
  if (new Date(request.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "expired" };
  }

  const token = generateCliToken();
  const tokenHash = sha256(token);
  const name = request.hostname || "CLI";
  const tokenExpiresAt = new Date(
    Date.now() + config.cliTokenTtlDays * 24 * 60 * 60 * 1000,
  );

  await db.begin(async (tx) => {
    await tx`
      insert into cli_tokens (token_hash, user_id, name, expires_at)
      values (${tokenHash}, ${userId}, ${name}, ${tokenExpiresAt})
    `;
    await tx`
      update cli_auth_requests
      set status = 'approved', user_id = ${userId}, token_hash = ${tokenHash}, token = ${token}
      where id = ${request.id}
    `;
  });
  return { ok: true };
}

export async function denyCliAuthRequest(
  code: string,
  db: Sql = defaultSql,
): Promise<{ ok: boolean }> {
  const rows = await db<{ id: string }[]>`
    update cli_auth_requests set status = 'denied'
    where code = ${normalizeCode(code)} and status = 'pending'
    returning id
  `;
  return { ok: rows.length > 0 };
}

export type PollResult =
  | { status: "pending" }
  | { status: "denied" }
  | { status: "expired" }
  | { status: "approved"; token: string; user: User };

/** Returns the plaintext token exactly once; the column is cleared in the same statement. */
export async function pollCliAuthRequest(
  code: string,
  db: Sql = defaultSql,
): Promise<PollResult> {
  const request = await getCliAuthRequest(code, db);
  if (!request) return { status: "expired" };
  if (request.status === "denied") return { status: "denied" };
  if (request.status === "pending") {
    if (new Date(request.expires_at).getTime() < Date.now()) return { status: "expired" };
    return { status: "pending" };
  }

  // RETURNING yields the new row, so read the old value through a subquery join.
  const rows = await db<{ token: string | null }[]>`
    update cli_auth_requests r
    set token = null
    from (select id, token from cli_auth_requests where id = ${request.id} for update) old
    where r.id = old.id and old.token is not null
    returning old.token
  `;
  const token = rows[0]?.token;
  if (!token || !request.user_id) return { status: "expired" };

  const users = await db<User[]>`select * from users where id = ${request.user_id}`;
  const user = users[0];
  if (!user) return { status: "expired" };
  return { status: "approved", token, user };
}

/** Verify a `drop_...` bearer token. Bumps last_used_at at most once a minute. */
export async function verifyCliToken(
  token: string,
  db: Sql = defaultSql,
): Promise<User | null> {
  if (!token || !token.startsWith(CLI_TOKEN_PREFIX)) return null;
  const rows = await db<(User & { token_id: string })[]>`
    select u.*, t.id as token_id
    from cli_tokens t
    join users u on u.id = t.user_id
    where t.token_hash = ${sha256(token)}
      and t.revoked_at is null
      and t.expires_at > now()
  `;
  const row = rows[0];
  if (!row) return null;

  await db`
    update cli_tokens set last_used_at = now()
    where id = ${row.token_id}
      and (last_used_at is null or last_used_at < now() - interval '1 minute')
  `;

  const { token_id: _tokenId, ...user } = row;
  return user as User;
}

/** Mint a token directly (dev-token endpoint, admin tooling). Returns the plaintext once. */
export async function mintCliTokenForUser(
  userId: string,
  name: string = "CLI",
  config: Config = defaultConfig,
  db: Sql = defaultSql,
): Promise<string> {
  const token = generateCliToken();
  await db`
    insert into cli_tokens (token_hash, user_id, name, expires_at)
    values (
      ${sha256(token)}, ${userId}, ${name},
      ${new Date(Date.now() + config.cliTokenTtlDays * 24 * 60 * 60 * 1000)}
    )
  `;
  return token;
}

export async function revokeCliToken(tokenId: string, db: Sql = defaultSql): Promise<void> {
  await db`update cli_tokens set revoked_at = now() where id = ${tokenId} and revoked_at is null`;
}
