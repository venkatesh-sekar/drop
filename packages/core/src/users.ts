import type { Config } from "./config";
import { config as defaultConfig } from "./config";
import type { Sql } from "./db";
import { sql as defaultSql } from "./db";

export interface User {
  id: string;
  external_user_id: string;
  display_name: string;
  email: string;
  created_at: Date;
  last_login_at: Date | null;
}

export interface UpsertUserInput {
  externalUserId: string;
  displayName: string;
  email: string;
}

/** Create or refresh a user identity and stamp last_login_at. */
export async function upsertUser(
  input: UpsertUserInput,
  db: Sql = defaultSql,
): Promise<User> {
  const rows = await db<User[]>`
    insert into users (external_user_id, display_name, email, last_login_at)
    values (${input.externalUserId}, ${input.displayName}, ${input.email}, now())
    on conflict (external_user_id) do update
      set display_name = excluded.display_name,
          email = excluded.email,
          last_login_at = now()
    returning *
  `;
  return rows[0]!;
}

export async function findUserById(id: string, db: Sql = defaultSql): Promise<User | null> {
  const rows = await db<User[]>`select * from users where id = ${id}`;
  return rows[0] ?? null;
}

export async function findUserByExternalId(
  externalUserId: string,
  db: Sql = defaultSql,
): Promise<User | null> {
  const rows = await db<User[]>`
    select * from users where external_user_id = ${externalUserId}
  `;
  return rows[0] ?? null;
}

export function isAdmin(
  user: Pick<User, "email"> | null | undefined,
  config: Config = defaultConfig,
): boolean {
  if (!user?.email) return false;
  return config.adminEmails.includes(user.email.trim().toLowerCase());
}
