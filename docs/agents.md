# Drop for humans and agents

Drop turns a folder of static files into a URL. This page covers installing the
`drop` CLI, wiring up the MCP server, and installing the agent skill.

The CLI talks to the Drop control app over REST. Everything else — the web UI, the
MCP server, the skill — is a wrapper around the same commands.

---

## 1. Install the CLI

From a checkout of this repo:

```bash
pnpm install
pnpm --filter @drop/cli build
npm i -g ./packages/cli
```

`npm i -g` on a local folder links it back to the repo, so `drop` picks up a
rebuild immediately — keep the checkout where it is. To install a copy that does
not depend on the checkout, pack it first:

```bash
pnpm --filter @drop/cli build
npm pack ./packages/cli --pack-destination /tmp && npm i -g /tmp/drop-cli-0.0.1.tgz
```

> `pnpm link --global` needs `pnpm setup` to have created a global bin directory
> first. If `pnpm setup` has not been run on the machine, use `npm i -g` above.

Check it:

```bash
drop --version
drop --help
```

### Point it at your Drop

Resolution order for the control URL: `--url` → `DROP_URL` → `~/.config/drop/config.json` → `http://localhost:3100`.

```bash
drop login --url https://drop.internal   # signs in AND remembers the URL
```

## 2. First login

```bash
drop login
```

This opens your browser, you complete the normal SSO, and the CLI stores a token in
`~/.config/drop/credentials.json` (mode `0600`, in `$XDG_CONFIG_HOME/drop` when that
is set). Any command that needs auth and has no token will start the same flow on
its own and then continue what you asked for.

```bash
drop whoami        # Signed in as Ada Lovelace <ada@example.com> (https://drop.internal)
drop logout        # forget the credential for this control URL
```

**Agents cannot do this step.** The browser flow needs a human. An agent that hits
`{"error":"unauthenticated"}` should ask the user to run `drop login` once, in a
terminal, and then retry.

## 3. Everyday use

```bash
drop deploy ./dist --path route-optimizer     # publish (expires in 30 days)
drop deploy ./dist --path dashboard --permanent
drop deploy ./dist --path app --spa           # index.html for unknown routes
drop list                                     # your sites
drop open route-optimizer
drop delete route-optimizer --yes
```

The folder needs `index.html` at its root. A single html file
(`drop deploy report.html`) or a `.zip` can be published on its own. Assets must
be referenced relatively — sites are served under `/<path>/`. See the skill
(below) for the per-framework base-path settings.

## 4. Agent usage

Agents should run the CLI with `--json --yes`. `--json` puts exactly one JSON
object on stdout and pushes every human-readable line to stderr; `--yes` skips the
interactive path prompt.

```bash
drop deploy ./dist --path route-optimizer --json --yes
```

```json
{"url":"https://sites.internal/route-optimizer/","path":"route-optimizer","expires_at":"2026-10-09T12:00:00.000Z","warnings":[]}
```

On failure stdout is `{"error":"...","message":"..."}` and the exit code is 1
(2 for a usage error). Notable codes: `path_taken`, `reserved_path`,
`invalid_path`, `missing_index`, `unauthenticated`.

Non-interactively the CLI never opens a browser and never blocks: with no
credential it exits 1 with
`{"error":"unauthenticated","message":"Run \`drop login\` in a terminal first."}`.

## 5. MCP server

`@drop/mcp` is a stdio MCP server exposing four tools — `drop_deploy`, `drop_list`,
`drop_delete`, `drop_whoami` — each of which shells out to the `drop` CLI with
`--json --yes`. It never touches credentials itself.

```bash
pnpm --filter @drop/mcp build
npm i -g ./packages/mcp      # provides `drop-mcp`
```

It finds the CLI via `DROP_CLI` → `drop` on `PATH` → `../cli/dist/drop.js` next to
its own bundle, and passes `DROP_URL` / `DROP_TOKEN` straight through.

### Claude Code

```bash
claude mcp add drop -- drop-mcp
```

Or commit it to the project as `.mcp.json`:

```json
{
  "mcpServers": {
    "drop": {
      "command": "drop-mcp",
      "env": { "DROP_URL": "https://drop.internal" }
    }
  }
}
```

### Cursor

`~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (per project):

```json
{
  "mcpServers": {
    "drop": {
      "command": "drop-mcp",
      "args": [],
      "env": { "DROP_URL": "https://drop.internal" }
    }
  }
}
```

### Codex

`~/.codex/config.toml`:

```toml
[mcp_servers.drop]
command = "drop-mcp"
args = []
env = { DROP_URL = "https://drop.internal" }
```

If `drop-mcp` is not on the agent's `PATH`, use an absolute command instead:
`"command": "node", "args": ["/path/to/drop/packages/mcp/dist/drop-mcp.js"]`, with
`"env": { "DROP_CLI": "/path/to/drop/packages/cli/dist/drop.js" }`.

## 6. Skill

The skill teaches an agent *when* to publish and how to avoid the two things that
actually go wrong (absolute asset paths, and pointing at source instead of build
output). It only needs the CLI — no MCP server.

```bash
cp -r skills/drop ~/.claude/skills/drop        # personal
cp -r skills/drop <project>/.claude/skills/drop  # per project
```

Other agents: point them at `skills/drop/SKILL.md`, or paste it into their rules
file.

## 7. CI

CI has no browser, so mint a token and pass it in the environment. `DROP_TOKEN`
takes precedence over the stored credential and skips the login flow entirely.

```yaml
- run: npm ci && npm run build
- run: npm i -g https://drop.internal/dist/drop-cli-latest.tgz   # or your artifact store
- run: drop deploy ./dist --path docs-preview --permanent --json
  env:
    DROP_URL: https://drop.internal
    DROP_TOKEN: ${{ secrets.DROP_TOKEN }}
```

The CLI is not on a public registry: publish `npm pack ./packages/cli` output to
your internal registry or artifact store and install it from there.

The CLI never prints the token. If `DROP_TOKEN` is rejected, the command fails with
`unauthenticated` rather than trying to open a browser.

## Reference

| Location | What |
| --- | --- |
| `~/.config/drop/config.json` | `{ "url": "..." }` — default control URL |
| `~/.config/drop/credentials.json` | tokens keyed by control URL, mode `0600` |
| `DROP_URL` | control URL (overridden by `--url`) |
| `DROP_TOKEN` | API token, wins over the stored credential |
| `DROP_CLI` | path to the `drop` binary, for the MCP server |
| `XDG_CONFIG_HOME` | respected; config lives in `$XDG_CONFIG_HOME/drop` |

Exit codes: `0` success, `1` user or API error, `2` usage error.
