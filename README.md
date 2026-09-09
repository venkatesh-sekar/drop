# Drop

**Drop a folder. Get a URL.**

Drop is a small internal platform for publishing static websites. A person, a script or a coding agent hands it a folder (or a single HTML file), gives it a name, and gets back a URL like `https://sites.internal/route-optimizer/`.

```bash
drop deploy ./dist --path route-optimizer
```

```
Publishing 42 files (1.3 MB) to route-optimizer...

Live:
https://sites.internal/route-optimizer/
```

## What is in this repo

| Path                | What it is                                                                          |
|---------------------|-------------------------------------------------------------------------------------|
| `apps/web`          | Control app: the publish page, My Drops, CLI setup, admin, auth and the REST API. Next.js 16 + shadcn. |
| `apps/gateway`      | Site gateway: serves published files from object storage on a separate origin.      |
| `packages/core`     | Shared code: config, Postgres access, S3/filesystem storage, archive validation, path rules, MIME types. |
| `packages/cli`      | The `drop` CLI.                                                                     |
| `packages/mcp`      | An MCP server that exposes `drop` to coding agents.                                 |
| `packages/ui`       | shadcn components shared by the control app.                                        |
| `skills/drop`       | An agent skill (Claude Code and friends) that teaches agents when and how to use `drop`. |
| `migrations/`       | Plain SQL migrations.                                                               |
| `examples/`         | Sample sites used by the smoke test.                                                |
| `docs/`             | Design notes and the human/agent guide.                                             |

Two runtime images come out of this repo: `drop-control` and `drop-gateway`. The CLI is distributed separately.

## Run it locally

Requirements: Node 22, pnpm 10, Docker.

```bash
pnpm install
cp .env.example .env          # dev values work as they are
docker compose up -d          # Postgres on :5440, MinIO on :9100 (console :9101)
pnpm db:migrate
pnpm dev                      # control app on http://localhost:3100, gateway on http://localhost:3101
```

Open http://localhost:3100. Development uses a mock sign-in page; pick any name and email. `ADMIN_EMAILS` in `.env` decides who sees the admin page.

Run the end-to-end smoke test against the running stack:

```bash
scripts/smoke.sh
```

## Use the CLI

```bash
pnpm --filter @drop/cli build && npm i -g ./packages/cli
drop login --url http://localhost:3100      # opens the browser once, stores a token
drop deploy examples/hello --path hello
```

`drop deploy report.html` publishes one file on its own. Options: `--path`, `--expires <days>`, `--permanent`, `--spa`, `--json`, `--yes`. See `docs/agents.md` for the MCP server, the skill, and CI usage with `DROP_TOKEN`.

## How it works

- **Auth.** Humans sign in through an OIDC provider (`AUTH_PROVIDER=oidc`) or the development mock. The CLI signs in with a device-style flow: it opens the browser, you approve once, and it stores a token locally. Agents only ever run `drop`; they never see credentials.
- **Publishing.** The client zips the folder and posts it. The server validates paths and limits, uploads every file under a fresh prefix in object storage, then switches the site to that prefix in one database update. Nobody sees a half-uploaded site.
- **Ownership.** The first user to publish a path owns it. Others get a clear error. Deleting a site frees the path.
- **Expiry.** Sites expire after 7 days by default. The web UI, `drop deploy --expires <days>` and the MCP `expiresInDays` option accept any whole number of days up to 365; `--permanent` or Never keeps a site forever. Expired sites stop being served but keep their path for the owner. `pnpm cleanup` marks expired sites and later removes their files.
- **Isolation.** The control app and published sites live on different origins, so uploaded JavaScript can never touch Drop's session.

## Production

Set real values in the environment (see `.env.example`): a Postgres URL, an S3 bucket, `CONTROL_URL` and `SITES_URL` on separate hosts, a long `SESSION_SECRET`, and the OIDC settings. Then:

```bash
docker compose --profile app up -d --build
```

`drop-cleanup` runs the expiry job hourly using the control image.
