import { serve } from "@hono/node-server";
import { closeDb, config, createStorage, findActiveSiteForServing } from "@drop/core";
import { createApp } from "./app";

const port = Number(process.env.PORT ?? 3101) || 3101;

const app = createApp({
  lookup: (path) => findActiveSiteForServing(path),
  storage: createStorage(config),
  config,
});

const server = serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, (info) => {
  console.log(`drop gateway listening on http://localhost:${info.port}`);
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`gateway: ${signal} received, shutting down`);
  server.close();
  await closeDb().catch(() => {});
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
