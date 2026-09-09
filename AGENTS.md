# Working in this repo

Drop is a pnpm + turbo monorepo. Read `product.md` for what it is and `docs/plans/2026-09-09-drop-design.md` for the contracts (env, schema, REST API, CLI behaviour) before changing anything.

- `pnpm dev` runs the control app (:3100) and gateway (:3101). Infra: `docker compose up -d` then `pnpm db:migrate`.
- `pnpm typecheck`, `pnpm test`, `pnpm build` must stay green. `scripts/smoke.sh` is the end-to-end check.
- Shared logic lives in `packages/core`. Don't duplicate path, archive, MIME or storage code in apps.
- Add shadcn components with `pnpm dlx shadcn@latest add <name> -c apps/web`; they land in `packages/ui`. Components are shadcn v4 on Base UI, not Radix.
- Keep the product small. The PRD's non-goals (section 23) are real; don't add tables or features for things that don't exist yet.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
