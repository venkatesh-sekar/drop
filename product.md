# Drop

## Product Requirements Document

**Status:** MVP Build Specification
**Product:** Drop
**Purpose:** Internal static website publishing
**Core promise:** **Drop a folder. Get a URL.**

---

# 1. Overview

Drop is a lightweight internal platform for publishing static websites.

A developer, user, script, or coding agent should be able to take a folder containing a static website and publish it with minimal effort.

Example:

```text
dashboard/
├── index.html
├── app.js
├── style.css
└── assets/
```

becomes:

```text
https://sites.internal/dashboard
```

Drop is intentionally not a general-purpose hosting platform.

The MVP should optimize for:

* simplicity
* low maintenance
* good developer experience
* agent compatibility
* reasonable internal security
* minimal infrastructure and product complexity

Slight implementation deviations are acceptable when they materially improve simplicity, security, maintainability, or UX.

---

# 2. Product Principles

## Zero configuration

A valid static website should require little or no configuration.

The ideal interaction is:

```text
Create static files
↓
Publish folder
↓
Receive URL
↓
Share
```

Users should not need to configure repositories, CI/CD, domains, hosting infrastructure, or deployment pipelines.

## Internal-first

Drop is an internal application.

It does not need public SaaS-level abuse prevention, billing, organizations, complex permissions, or sophisticated multi-tenancy.

Reasonable security boundaries should still be maintained.

## Static only

Drop serves static content such as:

* HTML
* CSS
* JavaScript
* images
* fonts
* JSON
* WebAssembly
* frontend build output from frameworks such as React, Vite, Vue, Svelte, or Astro

Drop must not execute uploaded server-side code.

Do not support:

* Node servers
* Python applications
* containers
* serverless functions
* databases
* arbitrary build commands

Users or agents provide already-built static output.

---

# 3. Authentication

## Human authentication

Users authenticate using the organization's SSO through an OAuth2/OIDC-compatible abstraction.

The exact production SSO implementation may be integrated later.

Development may use a mock authentication provider.

The application should internally resolve authentication into a stable user identity:

```text
user_id
display_name
email
```

Application ownership logic must depend on `user_id`, not email or display name.

---

# 4. CLI and Agent Authentication

Coding agents must be able to publish without receiving or handling raw authentication secrets.

Primary workflow:

```bash
drop deploy ./dist --path route-optimizer
```

If the CLI is not authenticated:

```text
Authentication required.
Opening browser...
```

The CLI should:

1. initiate a temporary authentication request
2. open Drop in the user's browser
3. allow the user to complete normal SSO
4. associate the authenticated user with the CLI
5. securely store the resulting credential locally
6. continue the original operation

After the initial login, commands should work without additional browser interaction until authentication expires or is revoked.

Example:

```bash
drop login
```

or authentication may happen automatically during the first command.

Credentials should preferably be stored using the operating system's secure credential storage where practical.

Do not require users to manually copy OAuth tokens or API keys into Claude Code, Codex, terminals, prompts, or configuration files.

Agents should only need permission to execute the `drop` CLI.

---

# 5. Human-Readable Paths

Every Drop should have a human-readable path.

Example:

```text
https://sites.internal/route-optimizer
https://sites.internal/sales-dashboard
https://sites.internal/store-analysis
```

When publishing from a folder, the UI or CLI may automatically suggest a path derived from the folder name.

Example:

```text
Route Optimizer
→ route-optimizer
```

Paths should:

* be globally unique
* be lowercase
* be URL-safe
* support letters, numbers, and hyphens
* reject reserved application routes

If another user already owns a path, the deployment must fail with a clear message.

If the current owner publishes to the same path again, the existing site may be updated.

---

# 6. Ownership

Every site belongs to the authenticated user who created it.

Basic rules:

```text
User A creates /route-optimizer
→ User A owns /route-optimizer

User A deploys again
→ allowed

User B attempts to deploy to /route-optimizer
→ rejected
```

Complex RBAC, teams, organizations, contributors, and transfers are not required for MVP.

An administrator may resolve exceptional ownership issues manually if necessary.

---

# 7. Expiry

Sites should default to temporary storage.

Recommended default:

```text
30 days
```

The exact duration should be configurable.

For MVP, supporting only:

```text
30 days
Never
```

is sufficient.

Permanent sites may require an explicit option such as:

```bash
drop deploy ./dist --path dashboard --permanent
```

or an equivalent UI option.

Expired sites should stop being served.

Do not immediately allow another user to claim an expired path.

A claimed path should remain associated with its owner unless explicitly released or deleted.

Physical object cleanup may happen later through a simple scheduled cleanup process.

---

# 8. Publishing

The Control service should accept static content through:

* browser folder upload
* ZIP upload
* REST API
* CLI

For MVP, requiring an `index.html` file is acceptable.

Publishing flow:

```text
Receive files
↓
Validate
↓
Create or update Site
↓
Upload files to object storage
↓
Make deployment active
↓
Return URL
```

Users must not see partially uploaded websites.

The implementation may use temporary storage prefixes or another simple atomic publishing strategy.

Do not over-engineer deployment orchestration.

---

# 9. Site Updates

Publishing again to a path owned by the same user should update that website.

Example:

```bash
drop deploy ./dist --path route-optimizer
```

The exact underlying storage strategy is implementation-dependent.

Immutable deployment history and rollback are optional.

They should only be implemented if they remain simple.

They are not required for the first usable version.

Correctness during replacement is more important than retaining every historical deployment.

---

# 10. Storage

Use:

* PostgreSQL for metadata
* S3-compatible object storage for website files

Website files must not be stored inside PostgreSQL.

A simple storage structure is sufficient.

Example:

```text
sites/
  <site-id>/
    index.html
    assets/
    app.js
```

The implementation may use versioned prefixes if needed for safe atomic updates.

---

# 11. Minimal Domain Model

The database should remain small.

Suggested entities:

## User

```text
id
external_user_id
display_name
email
created_at
last_login_at
```

## Site

```text
id
path
owner_user_id
storage_prefix
status
expires_at
created_at
updated_at
last_deployed_at
size_bytes
```

Additional fields may be introduced when useful.

Avoid creating tables for features that do not yet exist.

---

# 12. Site Gateway

Published websites should be served through a lightweight gateway.

Example:

```text
GET /route-optimizer/assets/app.js
```

The gateway resolves:

```text
route-optimizer
→ Site
→ storage location
→ assets/app.js
```

and returns the object with the appropriate MIME type.

The gateway should remain simple and stateless where practical.

PostgreSQL lookup caching may be added if necessary but is not required initially.

---

# 13. Browser Origin Isolation

The management application and uploaded websites must use different browser origins.

Example:

```text
Control:
https://drop.internal

Published websites:
https://sites.internal
```

This is an important security boundary because uploaded static websites may execute arbitrary JavaScript.

Uploaded JavaScript must not share authentication cookies or privileged browser context with the Drop management application.

---

# 14. Static Site Compatibility

Support normal static asset types and appropriate MIME types.

At minimum:

```text
html
css
js
mjs
json
png
jpg
jpeg
webp
gif
svg
ico
woff
woff2
ttf
wasm
txt
pdf
```

Directory requests should resolve to `index.html` where applicable.

SPA fallback may be supported with a simple option such as:

```bash
--spa
```

When enabled, unknown application routes may return `index.html`.

---

# 15. Base Path Constraint

Because websites are hosted under paths such as:

```text
/sites-dashboard/
```

uploaded applications should use relative assets or be built with the appropriate base path.

Example of potentially problematic output:

```html
<script src="/assets/app.js"></script>
```

Drop does not need to rewrite arbitrary JavaScript bundles.

A simple warning for obviously incorrect absolute asset references may be added if easy.

---

# 16. Upload Safety

Even though Drop is internal, basic upload protection should exist.

Reject:

* path traversal
* unsafe ZIP paths
* excessive decompressed archive size
* excessive individual file size
* excessive total deployment size
* excessive number of files

Limits should be configuration-driven.

Do not introduce sophisticated abuse detection unless needed.

---

# 17. Web Interface

The UI should remain extremely small.

Primary screen:

```text
Drop

Turn a folder into a website.

[ Drop folder or ZIP ]

Path
[ route-optimizer ]

Expiry
[ 30 days ]

[ Publish ]
```

After publishing:

```text
Your Drop is live

https://sites.internal/route-optimizer

[ Open ]
[ Copy URL ]
```

Authenticated users should have a lightweight **My Drops** page.

Example:

```text
My Drops

route-optimizer
Updated 5 minutes ago
Expires in 24 days

sales-dashboard
Updated yesterday
Permanent
```

Basic actions may include:

* open
* copy URL
* redeploy
* change expiry
* delete

Do not build a complex dashboard.

---

# 18. CLI

Provide a CLI named:

```bash
drop
```

Primary command:

```bash
drop deploy ./dist --path route-optimizer
```

Useful MVP options:

```text
--path
--permanent
--spa
--json
```

Example output:

```text
Publishing...

Live:
https://sites.internal/route-optimizer
```

Machine-readable output should be supported for agents:

```bash
drop deploy ./dist --path route-optimizer --json
```

Example:

```json
{
  "url": "https://sites.internal/route-optimizer",
  "path": "route-optimizer"
}
```

---

# 19. Agent Experience

Agents should not need to understand Drop's internal authentication or API implementation.

Agent instructions should be as simple as:

```text
To publish a static website:

drop deploy <folder> --path <name>
```

Desired agent flow:

```text
Generate website
↓
Run drop deploy
↓
Receive URL
↓
Return URL to user
```

REST APIs should exist underneath the CLI so future integrations such as MCP can reuse the same platform.

MCP itself is not required for MVP.

---

# 20. Administration

Do not build a full admin application.

A minimal admin capability is sufficient for exceptional cases such as:

* finding a site
* identifying its owner
* deleting a site
* expiring a site
* releasing a path

This may initially be implemented through restricted endpoints, database operations, or a very small internal admin screen.

---

# 21. Background Processing

Only lightweight scheduled work is required.

Potential tasks:

* mark expired sites
* delete storage for sufficiently old expired sites
* clean abandoned uploads

A simple scheduled job or worker is sufficient.

Do not introduce workflow orchestration infrastructure.

---

# 22. Deployment Model

Use a single repository.

Recommended high-level structure:

```text
drop/
├── control/
├── gateway/
├── cli/
├── shared/
├── migrations/
└── docker-compose.yml
```

The repository should produce two primary runtime images:

```text
drop-control
drop-gateway
```

The CLI may be distributed separately from the same repository.

Exact project structure and framework selection are implementation decisions.

---

# 23. Explicit MVP Non-Goals

Do not build unless a real need appears:

* guest publishing
* guest management tokens
* user-generated API keys
* custom domains
* Git integration
* automated builds
* server-side applications
* containers
* serverless functions
* per-site databases
* environment variables
* organizations
* teams
* complex RBAC
* deployment analytics
* billing
* public access management
* visual website editor
* deployment marketplace
* sophisticated CDN configuration
* advanced audit system
* full deployment history
* rollback
* MCP server

---

# 24. MVP Acceptance Criteria

A user should be able to:

1. authenticate through SSO
2. upload a folder containing `index.html`
3. choose `route-optimizer` as the path
4. receive:

```text
https://sites.internal/route-optimizer
```

5. open the URL and see the website
6. deploy a new version to the same path
7. see the site under **My Drops**
8. allow it to expire automatically after the configured period

A coding agent should be able to:

```bash
drop deploy ./dist --path route-optimizer
```

and receive the same URL without handling authentication credentials directly.

The first CLI authentication may require the human user to complete SSO in their browser.

---

# 25. Product North Star

Drop succeeds when users stop thinking about deployment.

For humans:

```text
I have a folder.
I give it a name.
I drop it.
It works.
I share the URL.
```

For agents:

```text
Generate artifact
↓
drop deploy
↓
Return URL
```

Everything beyond this requires justification.

**Keep the implementation boring, secure enough for an internal environment, easy to operate, and easy to replace or extend later.**

