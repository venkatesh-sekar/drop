# Drop — MVP design

Source of truth for the build. PRD: `product.md`. This doc records the implementation decisions made on top of it.

## Shape

pnpm + turbo monorepo (scaffolded with `shadcn init --preset b1VpZ9tI --template next --monorepo`).

```
apps/web         Control app: Next.js 16 (App Router), shadcn v4 (Base UI, style base-luma). UI + REST API + auth.   :3100
apps/gateway     Site gateway: Node 22 + Hono. path → site → storage → response.                                     :3101
packages/core    @drop/core  shared: config, db (postgres.js), storage (s3 | fs), migrations, path/zip validation, mime.
packages/cli     @drop/cli   `drop` CLI (bundled single file). Talks REST. Owns credential storage.
packages/mcp     @drop/mcp   MCP stdio server. Thin wrapper that shells out to the `drop` CLI with --json.
packages/ui      @workspace/ui shadcn components (from scaffold).
skills/drop      SKILL.md for coding agents (Claude Code etc).
docker-compose.yml  postgres :5440, minio :9100/:9101, drop-control, drop-gateway, drop-cleanup.
```

Two runtime images: `drop-control` (apps/web) and `drop-gateway` (apps/gateway). Cleanup is the control image run with a different command on a loop.

Origins are distinct by port in dev (`localhost:3100` vs `localhost:3101`) and by host in prod (`drop.internal` vs `sites.internal`). The gateway never sets or reads cookies.

## Config (env, loaded from repo-root `.env` by @drop/core)

```
DATABASE_URL=postgres://drop:drop@localhost:5440/drop
STORAGE_DRIVER=s3            # s3 | fs   (fs is for local dev/tests only)
STORAGE_FS_ROOT=.data/storage
S3_ENDPOINT=http://localhost:9100
S3_BUCKET=drop-sites
S3_ACCESS_KEY=drop
S3_SECRET_KEY=dropdropdrop
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
CONTROL_URL=http://localhost:3100
SITES_URL=http://localhost:3101
SESSION_SECRET=change-me-32-bytes-minimum
AUTH_PROVIDER=mock           # mock | oidc
OIDC_ISSUER= OIDC_CLIENT_ID= OIDC_CLIENT_SECRET=
ADMIN_EMAILS=admin@example.com
DEFAULT_EXPIRY_DAYS=30
EXPIRED_RETENTION_DAYS=30    # delete storage this long after expiry; row + path ownership stay
CLI_TOKEN_TTL_DAYS=90
MAX_FILES=5000
MAX_FILE_BYTES=26214400      # 25 MB
MAX_SITE_BYTES=209715200     # 200 MB
MAX_ARCHIVE_BYTES=209715200
```

## Database (migrations/*.sql, plain SQL, applied in order by `@drop/core` migrate script; `schema_migrations` table)

```sql
users        (id uuid pk default gen_random_uuid(), external_user_id text unique not null, display_name text not null,
              email text not null, created_at timestamptz default now(), last_login_at timestamptz)
sites        (id uuid pk, path text unique not null, owner_user_id uuid not null references users(id),
              storage_prefix text,                 -- null when no content is stored (expired+cleaned, or never deployed)
              status text not null check (status in ('active','expired')),
              spa boolean not null default false,
              expires_at timestamptz,              -- null = permanent
              size_bytes bigint not null default 0, file_count int not null default 0,
              created_at, updated_at, last_deployed_at timestamptz)
cli_auth_requests (id uuid pk, code text unique not null, status text check in ('pending','approved','denied'),
              user_id uuid references users(id), token_hash text, hostname text,
              created_at timestamptz default now(), expires_at timestamptz not null)
cli_tokens   (id uuid pk, token_hash text unique not null, user_id uuid not null references users(id),
              name text not null, created_at, last_used_at, expires_at timestamptz not null, revoked_at timestamptz)
```

Ownership rules use `owner_user_id`. Deleting a site (owner or admin) removes the row and storage, which frees the path. Expiry sets `status='expired'`; the row stays so the owner keeps the path and a redeploy reactivates it. Admin "release" = delete.

## Storage

Interface in `@drop/core`:

```ts
interface Storage {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>
  get(key: string): Promise<{ body: ReadableStream<Uint8Array>; size: number; contentType?: string } | null>
  deletePrefix(prefix: string): Promise<void>
}
```

Keys: `sites/<siteId>/<deployId>/<relative/file/path>`. A deploy uploads everything under a fresh `deployId`, then one `UPDATE sites SET storage_prefix=..., status='active', ...`. The old prefix is deleted best-effort after the switch. Readers never see a half-uploaded site.

## Archive validation (`@drop/core`)

Input: zip bytes. Output: `{ files: {path, bytes}[], warnings: string[] }` or a typed error. Rules:
- Reject entries with `..`, leading `/`, backslashes, empty segments, control chars, or names longer than 255 bytes.
- Skip `__MACOSX/`, `.DS_Store`, `Thumbs.db`, `.git/` entries and directory entries.
- If every remaining entry lives under one top-level folder and `index.html` is only inside it, strip that folder.
- Require `index.html` at root after stripping (`missing_index`).
- Enforce MAX_FILES, MAX_FILE_BYTES, MAX_SITE_BYTES, MAX_ARCHIVE_BYTES (`too_many_files`, `file_too_large`, `site_too_large`, `archive_too_large`).
- Warning (not error) when `index.html` references `src="/..."` or `href="/..."` that is not `//`: "Absolute asset paths will break under /<path>/. Use relative paths or set your build's base path."

## Paths

`normalizePath(input)`: lowercase, trim, spaces/underscores → `-`, strip everything not `[a-z0-9-]`, collapse `--`, trim `-`. Valid: `^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$`, 1–64 chars. Reserved (rejected): `api auth cli drops admin login logout static _next assets favicon.ico robots.txt health healthz sites drop www docs help settings account me new`.

`suggestPathFromFolder(folderPath)`: basename; if basename ∈ {dist, build, out, public, site, _site, www, html} use the parent's basename. Then normalize.

## REST API (apps/web, JSON, errors are `{ error: string, message: string }`)

Auth: browser session cookie (`drop_session`, httpOnly, sameSite=lax, signed JWT via `jose`) or `Authorization: Bearer drop_<token>`. CLI tokens are stored hashed (sha256).

```
GET    /api/me                          → { user: { id, display_name, email, is_admin } }        401 if none
GET    /api/sites                       → { sites: Site[] }   (mine, newest deploy first)
GET    /api/sites/:path                 → { site: Site }      404 unless mine (or admin)
POST   /api/sites/:path/deploy          multipart/form-data: archive (zip), expiry? ("30d"|"never"), spa? ("true"|"false")
                                        → 200 { url, path, site, warnings: string[] }
                                        409 path_taken (another user owns it) · 400 invalid_path | reserved_path |
                                        invalid_archive | missing_index | too_many_files | file_too_large | site_too_large | archive_too_large
                                        On create: expiry defaults to 30d. On redeploy: expiry/spa unchanged unless provided.
PATCH  /api/sites/:path                 { expiry?: "30d"|"never", spa?: boolean } → { site }
DELETE /api/sites/:path                 → 204  (removes row + files, frees path)

POST   /api/cli/auth/start              { hostname? } → { code, verify_url, poll_interval, expires_in }
POST   /api/cli/auth/poll               { code } → { status: "pending" } | { status: "approved", token, user } | { status: "denied" | "expired" }
GET    /api/cli/auth/:code              (session) → { hostname, created_at, status }
POST   /api/cli/auth/approve            (session) { code, approve: boolean } → { ok: true }

GET    /api/admin/sites?q=              (admin) → { sites: (Site & { owner: { id, display_name, email } })[] }
POST   /api/admin/sites/:path/expire    (admin) → { site }
DELETE /api/admin/sites/:path           (admin) → 204   (release)

POST   /api/dev/token                   (AUTH_PROVIDER=mock only) { email, display_name? } → { token }   for tests/agents
GET    /health                          → { ok: true }
```

Site JSON: `{ id, path, url, status: "active"|"expired", spa, expires_at, size_bytes, file_count, created_at, updated_at, last_deployed_at }`. `url` = `${SITES_URL}/${path}/`.

Auth routes: `GET /auth/login?next=` · `GET /auth/callback` · `POST /auth/logout` · mock provider: `GET /auth/mock` renders a tiny "sign in as" form (name + email), `POST /auth/mock` creates/updates the user and sets the session.

## Gateway (apps/gateway)

```
GET /                       tiny page: "Sites published with Drop are served here" + link to CONTROL_URL
GET /:path                  301 → /:path/          (so relative asset URLs resolve)
GET /:path/                 serve index.html
GET /:path/<file>           serve object at <storage_prefix>/<file>
                            if <file> has no extension and <file>/index.html exists → serve it
                            if not found and site.spa → serve index.html
                            else → 404 page
```

Site lookup: `select ... from sites where path=$1 and status='active' and (expires_at is null or expires_at > now())`, cached in memory 5 s. Headers: correct MIME from `@drop/core` mime map, `X-Content-Type-Options: nosniff`, `Cache-Control: no-cache` for html, `public, max-age=31536000, immutable` for filenames matching `\.[0-9a-f]{8,}\.` , else `public, max-age=300`. Never sets cookies. Also `GET /health`.

## CLI (`drop`)

```
drop deploy <folder> [--path <name>] [--permanent] [--spa] [--json] [--yes]
drop login | logout | whoami [--json]
drop list [--json]
drop delete <path> [--json] [--yes]
drop open <path>
```
- Control URL: `DROP_URL` env > `~/.config/drop/config.json` > `http://localhost:3100`.
- Credential: `~/.config/drop/credentials.json` (mode 0600) keyed by control URL. (OS keychain deferred — noted as a follow-up.)
- Not authenticated → "Authentication required. Opening browser..." → device flow (`/api/cli/auth/start`, open `verify_url`, poll) → store token → continue.
- No `--path`: suggestion from folder name; on a TTY prompt with that default, non-TTY uses the suggestion.
- `--json` prints exactly one JSON object on stdout (`{ url, path, warnings }` on success; `{ error, message }` + exit 1 on failure). Human output otherwise.
- Zips the folder in memory with `fflate`, uploads multipart with `fetch`.

## MCP server (`@drop/mcp`)

Stdio server with tools `drop_deploy`, `drop_list`, `drop_delete`, `drop_whoami`. Each spawns the `drop` CLI with `--json` and returns its output. Never touches credentials. If the CLI reports no auth, the tool result tells the agent to ask the human to run `drop login` once.

## Web UI (apps/web)

Pages: `/` (publish; signed-out shows the same layout with a sign-in call to action), `/drops` (My Drops), `/cli` (CLI, MCP and skill setup with copy blocks), `/cli/authorize?code=` (approve device login), `/admin` (admin only).

Design direction (from the preset): Inter, neutral surfaces, one crimson accent, pill buttons, generous radius. The publish page *is* the drop zone: one large target that fills the viewport, "Drop a folder. Get a URL." inside it. Below: a path field with a live URL preview (`localhost:3101/` dimmed, path in foreground), an expiry toggle (30 days / Never), a "Single-page app" toggle tucked under "More", and one crimson **Publish** button. Publishing shows progress in place; success replaces the target with the live URL, Open and Copy URL. My Drops is a plain list with hairline dividers, not cards. Light and dark. No decorative motion; only state changes animate.

Folder upload: `<input type="file" webkitdirectory>` and drag-drop of a folder (DataTransferItem.webkitGetAsEntry) or a `.zip`. Files are zipped in the browser with `fflate` and uploaded with XHR for progress.

## Background work

`pnpm cleanup` (in @drop/core): (1) `update sites set status='expired' where status='active' and expires_at < now()`; (2) for sites expired longer than EXPIRED_RETENTION_DAYS with a storage_prefix: delete storage, set storage_prefix null; (3) delete `cli_auth_requests` older than 1 h and revoked/expired `cli_tokens` older than 30 d. docker-compose runs it hourly in a loop.

## Testing

- `@drop/core`: vitest unit tests for path normalization/reserved words, archive validation (traversal, single-folder strip, missing index, limits), mime.
- `@drop/cli`: vitest for suggestPathFromFolder and arg parsing.
- `scripts/smoke.sh`: end-to-end against a running stack with the mock provider: mint a dev token, deploy `examples/hello`, fetch it through the gateway, redeploy, PATCH expiry, delete.
