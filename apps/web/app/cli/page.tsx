import type { Metadata } from "next"
import Link from "next/link"
import { config } from "@drop/core"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { CopyBlock } from "@/components/copy-block"
import { cliVersion, installCommand } from "@/lib/dist"

export const metadata: Metadata = { title: "CLI · Drop" }

const link =
  "rounded-sm text-foreground underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/30"

function Section({
  id,
  title,
  children,
}: {
  id?: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="text-lg font-medium">{title}</h2>
      <div className="mt-1.5 space-y-3 text-sm text-muted-foreground">
        {children}
      </div>
    </section>
  )
}

export default async function CliPage() {
  const url = config.controlUrl
  const version = await cliVersion()

  const mcpJson = JSON.stringify(
    { mcpServers: { drop: { command: "drop-mcp", env: { DROP_URL: url } } } },
    null,
    2
  )
  const cursorJson = JSON.stringify(
    {
      mcpServers: {
        drop: { command: "drop-mcp", args: [], env: { DROP_URL: url } },
      },
    },
    null,
    2
  )
  const codexToml = [
    "[mcp_servers.drop]",
    'command = "drop-mcp"',
    "args = []",
    `env = { DROP_URL = "${url}" }`,
  ].join("\n")
  const skillInstall = [
    "mkdir -p ~/.claude/skills/drop",
    `curl -fsSL ${url}/install/SKILL.md -o ~/.claude/skills/drop/SKILL.md`,
  ].join("\n")

  const options: [string, string][] = [
    [
      "--path <name>",
      "The URL. Suggested from the folder or file name if you leave it out.",
    ],
    [
      "--expires <days>",
      `Expire after that many days, 1 to 365. Default ${config.defaultExpiryDays}.`,
    ],
    ["--permanent", "Never expire."],
    [
      "--spa",
      "Serve index.html for unknown routes, for apps with a client-side router.",
    ],
    [
      "--json",
      "Print one line of JSON on stdout. Everything else goes to stderr.",
    ],
    [
      "--yes",
      "Never wait at a prompt. Use it with --json when a script or agent runs the CLI.",
    ],
  ]

  return (
    <article className="pt-8 sm:pt-12">
      <h1 className="text-[2rem] leading-tight font-medium tracking-tight sm:text-[2.5rem]">
        Drop from your terminal
      </h1>
      <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-muted-foreground">
        The <code>drop</code> command publishes exactly what the page does, from
        a shell, a script or a coding agent. Nothing to clone: one line installs
        it and points it at this Drop.
      </p>

      <div className="mt-12 space-y-12">
        <Section id="install" title="Install">
          <p>
            Needs Node.js 20 or newer. Puts <code>drop</code> and{" "}
            <code>drop-mcp</code> in <code>~/.local/bin</code>
            {version ? ` (version ${version})` : ""}. Run the same line again to
            update. On Windows, run it inside WSL.
          </p>
          <CopyBlock code={installCommand} />
        </Section>

        <Section id="login" title="Sign in once">
          <p>
            Opens your browser for the usual sign-in and asks you to approve
            this machine. The CLI keeps a credential in{" "}
            <code>~/.config/drop/</code> for {config.cliTokenTtlDays} days;
            after that it asks again. <code>drop logout</code> forgets it.
          </p>
          <CopyBlock code="drop login" />
        </Section>

        <Section id="publish" title="Publish">
          <p>
            Point it at your built output (<code>dist</code>, <code>build</code>
            , <code>out</code>), a single HTML file or a .zip. It prints the
            URL.
          </p>
          <CopyBlock code="drop deploy ./dist --path route-optimizer" />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Option</TableHead>
                  <TableHead>What it does</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {options.map(([flag, what]) => (
                  <TableRow key={flag}>
                    <TableCell className="whitespace-nowrap">
                      <code>{flag}</code>
                    </TableCell>
                    <TableCell className="whitespace-normal text-muted-foreground">
                      {what}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p>
            Also: <code>drop list</code>, <code>drop open {"<name>"}</code>,{" "}
            <code>drop delete {"<name>"}</code>, <code>drop whoami</code>.{" "}
            <code>drop --help</code> has the rest. Publishing to a name you own
            replaces the site at the same URL.
          </p>
        </Section>

        <Section id="agents" title="For coding agents">
          <p>
            Agents never sign in and never see a credential. You install the CLI
            and run <code>drop login</code> once; after that the agent only
            needs to be allowed to run <code>drop</code>. When it is,
            &ldquo;publish this&rdquo; is enough and it comes back with the URL.
          </p>
          <CopyBlock code="drop deploy ./dist --path route-optimizer --json --yes" />
          <p>
            If an agent reports <code>{'{"error":"unauthenticated"}'}</code>,
            run <code>drop login</code> in a terminal and let it retry.
          </p>

          <h3 className="pt-2 text-[15px] font-medium text-foreground">
            Skill
          </h3>
          <p>
            The quickest setup. A skill teaches the agent when to publish, to
            point at build output rather than source, and to keep asset paths
            relative. It needs only the CLI. For Claude Code:
          </p>
          <CopyBlock code={skillInstall} />
          <p>
            Other agents: fetch the same{" "}
            <a href={`${url}/install/SKILL.md`} className={link}>
              SKILL.md
            </a>{" "}
            and paste it into their rules file.
          </p>

          <h3 className="pt-2 text-[15px] font-medium text-foreground">
            MCP server
          </h3>
          <p>
            <code>drop-mcp</code> is installed alongside the CLI and exposes{" "}
            <code>drop_deploy</code>, <code>drop_list</code>,{" "}
            <code>drop_delete</code> and <code>drop_whoami</code> as tools. Use
            it when the agent works better with tools than with shell commands.
          </p>
          <Tabs defaultValue="claude">
            <TabsList>
              <TabsTrigger value="claude">Claude Code</TabsTrigger>
              <TabsTrigger value="cursor">Cursor</TabsTrigger>
              <TabsTrigger value="codex">Codex</TabsTrigger>
            </TabsList>
            <TabsContent value="claude">
              <p>
                One command, or commit the JSON to the project as{" "}
                <code>.mcp.json</code>.
              </p>
              <CopyBlock code="claude mcp add drop -- drop-mcp" />
              <CopyBlock code={mcpJson} />
            </TabsContent>
            <TabsContent value="cursor">
              <p>
                <code>~/.cursor/mcp.json</code> for every project, or{" "}
                <code>.cursor/mcp.json</code> in one.
              </p>
              <CopyBlock code={cursorJson} />
            </TabsContent>
            <TabsContent value="codex">
              <p>
                Add to <code>~/.codex/config.toml</code>.
              </p>
              <CopyBlock code={codexToml} />
            </TabsContent>
          </Tabs>
          <p>
            If <code>drop-mcp</code>{" "}
            is not on the agent&rsquo;s PATH, use the
            full path: <code>~/.local/bin/drop-mcp</code>.
          </p>
        </Section>
      </div>

      <p className="mt-16 text-sm text-muted-foreground">
        Wondering about names, expiry or what you can publish?{" "}
        <Link href="/how-it-works" className={link}>
          How it works
        </Link>
        .
      </p>
    </article>
  )
}
