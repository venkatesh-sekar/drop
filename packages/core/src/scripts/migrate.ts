import { closeDb, migrate } from "../db";

async function main(): Promise<void> {
  const ran = await migrate();
  if (ran.length === 0) {
    console.log("migrate: no pending migrations");
  } else {
    for (const name of ran) console.log(`migrate: applied ${name}`);
    console.log(`migrate: ${ran.length} migration(s) applied`);
  }
}

main()
  .then(() => closeDb())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error("migrate failed:", err instanceof Error ? err.message : err);
    await closeDb().catch(() => {});
    process.exit(1);
  });
