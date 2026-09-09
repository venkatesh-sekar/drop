# Drop — UI design plan (apps/web)

Subject: an internal tool used by engineers, analysts and coding agents to publish a built static folder. Audience already knows what a folder and a URL are. The page has one job: publish. Everything else is secondary.

## Tokens (inherited from the shadcn preset in packages/ui/src/styles/globals.css — do not fight them)

| name    | role                                  | value (light)                     |
|---------|---------------------------------------|-----------------------------------|
| Paper   | page background                       | `--background` oklch(1 0 0)       |
| Ink     | text                                  | `--foreground` oklch(0.145 0 0)   |
| Crimson | the one accent: Publish, "live" state | `--primary` oklch(0.505 0.213 27.5) |
| Fog     | secondary text, hints                 | `--muted-foreground`              |
| Line    | hairlines, the drop target's border   | `--border`                        |

Dark mode swaps via `.dark` as the preset already does. Never introduce a second accent. Use Crimson for exactly one control per screen.

## Type

Inter only (already wired as `--font-sans`). Display: 40–56px, weight 500, `tracking-tight`, `text-balance`. Body 15–16px/1.6. Small text 13px. No all-caps labels, no eyebrow labels, no monospace for small metadata. The URL is set in Inter too, large, with the host portion in Fog and the path in Ink.

## Layout

Single left-aligned column, max-width 720px, generous top padding. Slim header: wordmark "Drop" left; "My Drops", "CLI", avatar/sign-in right.

```
Drop                                   My Drops   CLI   (avatar)

┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
│                                                          │
│   Drop a folder. Get a URL.                              │   ← the hero IS the drop target (~55vh, dashed Line border,
│   Drag a folder or a .zip here, or choose a folder.      │      2xl radius). Whole area clickable + keyboard focusable.
│                                                          │
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘

localhost:3101/ route-optimizer|                                ← URL composer: fixed dimmed host + inline editable path,
                                                                   one big line (text-2xl). What you type IS the URL.
Expires in 30 days      Never                    More            ← segmented choice (two buttons), "More" reveals the
                                                                   "Single-page app" switch with one-line help.
                                                     Publish     ← the only Crimson element.
```

After a folder is chosen the target shrinks to a summary row: folder name, file count, total size, "index.html found" (or a clear error), and a "Change" link. Publishing shows a thin progress bar inside that row and the button reads "Publishing…". Success replaces the form:

```
Your Drop is live.

localhost:3101/route-optimizer/                                  ← large, selectable, Crimson underline on hover
Open      Copy URL                                               ← Open is Crimson, Copy is outline
Expires in 30 days · change  ·  Publish another                   (no middle dots in the real UI — use spacing)
```

Errors are inline and specific, in the interface's voice: "route-optimizer is taken by someone else. Try another name." · "Only letters, numbers and hyphens." · "No index.html at the top of this folder. Choose your build output (dist, build, out)." · "That's over the 200 MB limit."

Signed out: the same page renders, the target says "Sign in to publish" and everything is enabled but Publish triggers sign-in.

My Drops (`/drops`): a plain list with hairline dividers. Each row: path (medium weight) and status line in Fog ("Updated 5 minutes ago · Expires in 24 days" → use a small gap, not a dot), right side: Open, Copy URL, and a menu (Redeploy, Change expiry, Delete). Expired rows are dimmed with "Expired 2 days ago · Redeploy to bring it back". Empty state: "No Drops yet. Publish your first one." with a link to `/`.

CLI (`/cli`): three short sections with copy buttons: "Install", "For coding agents" (the one command + AGENTS.md snippet), "MCP" (config JSON). Also shows the skill install line.

Authorize (`/cli/authorize?code=`): "Sign in to the Drop CLI on <hostname>?" with the code shown large, Approve (Crimson) and Deny.

Admin (`/admin`): a search box, results as the same list style with owner name and email, actions Expire / Release.

## Motion and quality floor

Only state changes animate: drop-target border/tint on dragover, the progress bar, and the cross-fade to the success state. No entrance animations. Respect `prefers-reduced-motion`. Keyboard: the drop target is a button; all actions reachable by Tab; visible focus rings (preset provides). Responsive to 360px: the URL composer wraps host above path. Light and dark both checked.

## Principles

- The page is a single gesture: drop, name, publish.
- No cards. Hierarchy comes from size and spacing, not boxes.
- One accent, one job.
- Words do work: every label says what happens; "Publish" → "Publishing…" → "live".
