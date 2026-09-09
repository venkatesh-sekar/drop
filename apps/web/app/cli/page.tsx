import type { Metadata } from "next"
import { config } from "@drop/core"

import { CopyBlock } from "@/components/copy-block"

export const metadata: Metadata = { title: "CLI · Drop" }

export default function CliPage() {
  const url = config.controlUrl

  const install = [
    "pnpm --filter @drop/cli build",
    "npm i -g ./packages/cli",
    "",
    `drop login --url ${url}`,
  ].join("\n")

  const agents = "drop deploy ./dist --path route-optimizer --json --yes"

  const mcp = JSON.stringify(
    { mcpServers: { drop: { command: "drop-mcp", env: { DROP_URL: url } } } },
    null,
    2,
  )

  const skill = "cp -r skills/drop ~/.claude/skills/drop"

  return (
    <section className="pt-8 sm:pt-12">
      <h1 className="text-[2rem] leading-tight font-medium tracking-tight sm:text-[2.5rem]">
        Drop from your terminal
      </h1>
      <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-muted-foreground">
        The CLI publishes the same way this page does. This Drop lives at{" "}
        <span className="text-foreground">{url}</span>, which is not the CLI&rsquo;s default, so
        point it there once with <span className="text-foreground">--url</span>.
      </p>

      <div className="mt-12 space-y-12">
        <div>
          <h2 className="text-lg font-medium">Install</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            From a checkout of the Drop repo. <code>drop login</code> opens your browser once and
            remembers the URL.
          </p>
          <CopyBlock code={install} />
        </div>

        <div>
          <h2 className="text-lg font-medium">For coding agents</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            One command, machine-readable. <code>--json</code> prints a single JSON object;{" "}
            <code>--yes</code> keeps it from waiting at a prompt. Point the agent at the built
            output, not the source.
          </p>
          <CopyBlock code={agents} />
          <p className="mt-3 text-sm text-muted-foreground">
            Agents cannot sign in themselves. If a command returns{" "}
            <code>{'{"error":"unauthenticated"}'}</code>, run <code>drop login</code> yourself once.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-medium">MCP</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            <code>drop-mcp</code> exposes drop_deploy, drop_list, drop_delete and drop_whoami. Add
            it to Claude Code with <code>claude mcp add drop -- drop-mcp</code>, or commit this as{" "}
            <code>.mcp.json</code>.
          </p>
          <CopyBlock code={mcp} />
        </div>

        <div>
          <h2 className="text-lg font-medium">Skill</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Teaches an agent when to publish and how to avoid the two things that actually go
            wrong: absolute asset paths, and pointing at source instead of build output. Needs the
            CLI only.
          </p>
          <CopyBlock code={skill} />
        </div>
      </div>
    </section>
  )
}
