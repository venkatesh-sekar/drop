# Drop — explain itself, and install in one line

Goal: someone who receives a link to Drop should understand what it is, how it
works and what they can do, without asking. Someone who wants the CLI should
not need a checkout of this repo.

Two constraints from the brief: the UI keeps its shape (no walls of text; help
appears where a question arises), and shadcn components are used wherever one
fits.

## 1. Help where the question is

A small `Hint` component: a `?` icon button that opens a shadcn Popover
(Base UI, `openOnHover` so it also opens on hover, and on click/focus for
touch and keyboard). Content is one to three sentences plus an optional
"Learn more" link into the How it works page. Tooltips are not used for this:
they cannot hold a link and do not open on touch.

Where hints go, and what they say (the exact copy is in the components):

| Place | Question it answers |
|---|---|
| Publish: under the drop target | What can I drop? (built output, index.html, single HTML, zip, limits) |
| Publish: the name | What is this name? Who owns it? What happens when I publish again? |
| Publish: expiry | What happens when it expires? Can I change it later? |
| Publish: single-page app switch | When do I need this? |
| Success: expiry line | Same as expiry |
| My Drops: heading | What "expired" means, that the name stays yours |
| Authorize CLI | What am I approving, for how long |

Wording changes that carry information for free:

- Expiry select items read "Expires in 7 days", "Expires in 30 days",
  "Expires in 60 days", "Custom…", "Never expires" instead of bare numbers.
- "More" becomes "More options" and opens a shadcn Collapsible.
- The success screen says who can open the URL and how to update the site.
- The signed-out drop target says which account signs in and that published
  sites are visible to anyone who can reach the sites host.
- My Drops rows get a Badge for "Expired" and "Permanent".

## 2. A How it works page

`/how-it-works`, linked from the header (shown as "Help" on narrow screens).
Sections with anchors, short prose, no marketing:

1. What Drop is — folder in, URL out, the three steps.
2. Three ways to publish — the page, the CLI, a coding agent.
3. Names — the URL, the rules, first-publisher ownership, update, delete.
4. Expiry — default, options, what expiry does, retention, change any time.
5. What you can publish — static only, index.html, single HTML, zip, relative
   asset paths (with the per-framework base-path setting), the SPA option.
6. Where sites live — separate host, who can see them, why the two hosts.
7. Limits — a shadcn Table filled from `config` so it is never stale.
8. Questions — a shadcn Accordion: updating, taken names, broken assets,
   deep links, expired sites, agent sign-in, revoking the CLI.

## 3. Install the CLI in one line

The CLI is already a single self-contained ESM file (`packages/cli/dist/drop.js`,
fflate inlined). The MCP server becomes one too (`noExternal: [/.*/]`, ~740 KB,
verified to answer `initialize`). The control app serves both, plus the skill,
and an install script:

| Route | Serves |
|---|---|
| `GET /install` | POSIX sh script, `text/x-shellscript`, with this Drop's URL baked in |
| `GET /install/drop.js` | the CLI bundle |
| `GET /install/drop-mcp.js` | the MCP bundle |
| `GET /install/SKILL.md` | the agent skill |

Files are read at request time from the repo (`findRepoRoot()` from core), so
`pnpm dev` (tsup watch) and the Docker image both work. A missing bundle
returns 503 with the build command in the message. `Cache-Control: no-cache`.

```
curl -fsSL https://drop.internal/install | sh
```

The script:

- needs `curl` or `wget`, and Node 20+ (`node -v`); says exactly what to
  install when either is missing and exits 1.
- downloads both bundles into `~/.drop/lib/`.
- writes two-line sh wrappers `drop` and `drop-mcp` into `~/.local/bin`
  (override with `DROP_BIN_DIR`). Wrappers pin the Node found at install time
  and fall back to `node` on PATH. A wrapper, not a rename: an extensionless
  ESM file does not run on Node 20.
- writes `url` into `~/.config/drop/config.json` (merging, via `node -e`),
  so `drop login` needs no `--url`.
- prints a PATH hint if `~/.local/bin` is not on PATH, then `drop --version`
  and "Next: drop login".
- re-running it updates. Windows: WSL.

The MCP server also looks for `drop.js` beside its own file, so the pair
works even when `~/.local/bin` is not on the agent's PATH.

Docker: the control image builds `@drop/cli` and `@drop/mcp` and keeps
`skills/drop/SKILL.md` (`.dockerignore` currently drops all `*.md`).

## 4. CLI page rewrite

Sections, each with a copy block: Install (the curl line, Node note, update
note) · Sign in (`drop login`, what it stores, token lifetime from config) ·
Publish (one command, options in a Table) · Coding agents: skill install
line, then the MCP config in Tabs for Claude Code / Cursor / Codex / other.
CI is left in `docs/agents.md`: there is no production way to mint a token
yet, so the page does not promise one.

## 5. Not doing

Standalone binaries (would need per-platform builds), a `drop update`
command (re-run the install line), token management UI, analytics, a
walkthrough overlay. Reserved names gain `install` because it is now a route,
matching the existing convention.
