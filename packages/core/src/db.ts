import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { config, findRepoRoot } from "./config";

export type Sql = postgres.Sql<{}>;

let _sql: Sql | undefined;

/** Lazily-created postgres.js singleton. */
export function getSql(): Sql {
  if (!_sql) {
    _sql = postgres(config.databaseUrl, { max: 10, onnotice: () => {} });
  }
  return _sql;
}

/** Proxy so `sql\`...\`` works without forcing a connection at import time. */
export const sql: Sql = new Proxy(function () {} as unknown as Sql, {
  apply(_target, _thisArg, args: unknown[]) {
    return (getSql() as unknown as (...a: unknown[]) => unknown)(...args);
  },
  get(_target, prop, receiver) {
    return Reflect.get(getSql() as unknown as object, prop, receiver);
  },
}) as Sql;

export async function closeDb(): Promise<void> {
  if (_sql) {
    const s = _sql;
    _sql = undefined;
    await s.end({ timeout: 5 });
  }
}

export function migrationsDir(): string {
  return path.join(findRepoRoot(), "migrations");
}

/** Apply pending migrations from migrations/*.sql in filename order. */
export async function migrate(db: Sql = getSql()): Promise<string[]> {
  await db`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `;

  const dir = migrationsDir();
  if (!fs.existsSync(dir)) return [];
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const appliedRows = await db<{ name: string }[]>`select name from schema_migrations`;
  const applied = new Set(appliedRows.map((r) => r.name));

  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sqlText = fs.readFileSync(path.join(dir, file), "utf8");
    await db.begin(async (tx) => {
      await tx.unsafe(sqlText).simple();
      await tx`insert into schema_migrations (name) values (${file})`;
    });
    ran.push(file);
  }
  return ran;
}
