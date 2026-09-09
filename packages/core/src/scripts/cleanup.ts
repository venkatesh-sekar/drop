import { config } from "../config";
import { closeDb, sql } from "../db";
import { createStorage } from "../storage/index";

async function main(): Promise<void> {
  // 1. Mark sites whose expiry has passed.
  const expired = await sql<{ id: string }[]>`
    update sites set status = 'expired', updated_at = now()
    where status = 'active' and expires_at is not null and expires_at < now()
    returning id
  `;
  console.log(`cleanup: expired ${expired.length} site(s)`);

  // 2. Delete storage for sites expired longer than the retention window.
  const storage = createStorage(config);
  const stale = await sql<{ id: string; path: string; storage_prefix: string }[]>`
    select id, path, storage_prefix from sites
    where status = 'expired'
      and storage_prefix is not null
      and expires_at is not null
      and expires_at < now() - (${config.expiredRetentionDays} || ' days')::interval
  `;
  let purged = 0;
  for (const site of stale) {
    try {
      await storage.deletePrefix(site.storage_prefix);
      await sql`update sites set storage_prefix = null, size_bytes = 0, file_count = 0, updated_at = now() where id = ${site.id}`;
      purged++;
    } catch (err) {
      console.error(
        `cleanup: failed to purge ${site.path}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  console.log(`cleanup: purged storage for ${purged} site(s)`);

  // 3. Drop stale CLI auth requests and long-dead tokens.
  const requests = await sql<{ id: string }[]>`
    delete from cli_auth_requests where created_at < now() - interval '1 hour' returning id
  `;
  const tokens = await sql<{ id: string }[]>`
    delete from cli_tokens
    where (revoked_at is not null and revoked_at < now() - interval '30 days')
       or (expires_at < now() - interval '30 days')
    returning id
  `;
  console.log(
    `cleanup: removed ${requests.length} cli auth request(s), ${tokens.length} cli token(s)`,
  );
}

main()
  .then(() => closeDb())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error("cleanup failed:", err instanceof Error ? err.message : err);
    await closeDb().catch(() => {});
    process.exit(1);
  });
