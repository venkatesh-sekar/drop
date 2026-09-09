---
name: drop
description: Publish, share, deploy or host a static site, HTML export, dashboard, report, prototype or docs build and get a shareable URL back. Use when the user says "publish this", "share this page", "put this online", "give me a link", "host this", or after you build any static HTML/CSS/JS output they will want to open in a browser.
---

# Drop

Drop turns a folder of static files into a URL. One command, no config, no CI.

## When to use it

Use Drop as soon as you have built static output the user will want to open or
share: a dashboard, an HTML report, a Vite/Next/Astro build, a slide deck, a
prototype, a docs site. Prefer it over telling the user to run a local server.

Do not use it for anything that needs a server at runtime (an API, a database,
server-side rendering). Drop serves files, nothing else.

## The one command

```bash
drop deploy <folder> --path <name> --json
```

`<folder>` is the **built output** (`dist/`, `build/`, `out/`, `_site/`), not the
source. It must contain `index.html` at its root. For a one-page result
(`report.html`, a rendered notebook, a chart) point `drop deploy` at the html
file itself; it is published as `index.html`:

```bash
drop deploy ./report.html --path q3-report --json
```

Success prints exactly one line of JSON on stdout:

```json
{
  "url": "https://sites.internal/route-optimizer/",
  "path": "route-optimizer",
  "expires_at": "2026-10-09T12:00:00.000Z",
  "warnings": []
}
```

Give the `url` back to the user. Failure prints one line of JSON too, and exits 1:

```json
{ "error": "path_taken", "message": "\"route-optimizer\" is owned by someone else. Pick a different --path." }
```

Always pass `--json`. Add `--yes` when running non-interactively so the CLI never
waits at a prompt.

## Picking a path

The path is the URL: `https://sites.internal/<path>/`. Lowercase letters, numbers
and hyphens, 1-64 characters.

Name it after the *thing*, not the folder: `route-optimizer`, `q3-sales-review`,
`checkout-prototype`. Avoid generic names like `dashboard` or `report` - paths are
global and first-come, first-served.

If you omit `--path`, Drop derives one from the folder name (and skips build-output
names like `dist`, using the parent folder instead).

## Assets must be relative

Sites are served under `/<path>/`, so absolute asset URLs break:

```html
<script src="/assets/app.js"></script>   <!-- 404 -->
<script src="./assets/app.js"></script>  <!-- works -->
```

Fix it in the build config before deploying, not after:

| Framework | Setting |
| --- | --- |
| Vite | `base: './'` in `vite.config.ts` |
| Next.js | `output: 'export'` plus `basePath: '/<path>'` and `assetPrefix: '/<path>/'` |
| Astro | `base: '/<path>'` in `astro.config.mjs` |
| Plain HTML | write `./style.css`, never `/style.css` |

Drop returns a `warnings` array when it spots absolute paths in `index.html`. If it
is non-empty, tell the user, or rebuild with the right base and deploy again.

## Options

- `--permanent` - never expires. Without it a site expires in 30 days, which is the
  right default for one-off reports and prototypes.
- `--spa` - serve `index.html` for unknown routes. Needed for client-side routers
  (React Router, Vue Router) so a deep link does not 404.
- `--path <name>` - the URL path.
- `--json` / `--yes` - always, when you are the one running it.

## When it fails

- `path_taken` - someone else owns that path. Pick a different one and retry.
  Never try to take it from them.
- `reserved_path` / `invalid_path` - rename to lowercase letters, numbers, hyphens.
- `missing_index` - you pointed at source, not build output, or at a folder
  without `index.html`. Build first and point at `dist/`, `build/` or `out/`,
  or point at a single html file.
- `unauthenticated` - **stop and ask the user** to run `drop login` once in their
  terminal. It opens their browser for SSO and stores the credential. Never ask
  them for a token, and never try to log in on their behalf.
- `site_too_large` / `too_many_files` - the folder holds something it should not
  (source maps, a `node_modules`, raw data). Trim it and retry.

## Other commands

```bash
drop list --json              # your sites: path, url, status, expiry
drop delete <path> --yes      # delete a site and free its path
drop whoami --json            # who the CLI is signed in as
drop open <path>              # open a site in the browser
```

## Redeploying

Deploying to a path you already own replaces the site in place, at the same URL.
That is the normal way to publish an update - do not invent `-v2` paths.
