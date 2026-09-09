import type { Metadata } from "next"
import Link from "next/link"
import { config } from "@drop/core"
import { EXPIRY_PRESET_DAYS, MAX_EXPIRY_DAYS } from "@drop/core/expiry"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { CopyBlock } from "@/components/copy-block"
import { installCommand } from "@/lib/dist"
import { formatBytes } from "@/lib/time"

export const metadata: Metadata = { title: "How it works · Drop" }

const link =
  "rounded-sm text-foreground underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="text-xl font-medium tracking-tight">
        <a
          href={`#${id}`}
          className="rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          {title}
        </a>
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  )
}

export default function HowItWorksPage() {
  const sitesHost = new URL(config.sitesUrl).host
  const controlHost = new URL(config.controlUrl).host
  const presets = EXPIRY_PRESET_DAYS.map((d) => `${d} days`).join(", ")

  const questions: { q: string; a: React.ReactNode }[] = [
    {
      q: "How do I update a site?",
      a: (
        <>
          Publish to the same name again. The new files replace the old ones at
          the same URL, all at once, so nobody sees a half-uploaded site. From
          My Drops, <strong>Redeploy</strong> opens the publish page with the
          name filled in.
        </>
      ),
    },
    {
      q: "The name I want is taken.",
      a: (
        <>
          Someone else published it first, and names are first come, first
          served. Pick another one. Names stay with their owner even after the
          site expires, until the owner deletes it or an admin releases it.
        </>
      ),
    },
    {
      q: "My site loads but the CSS, JavaScript or images are missing.",
      a: (
        <>
          The page references assets with absolute paths like{" "}
          <code>/app.js</code>. Sites are served under <code>/{"<name>"}/</code>
          , so that points at the wrong place. Use relative paths (
          <code>./app.js</code>) or set your framework&rsquo;s base path, then
          publish again. Drop warns you when it spots this in{" "}
          <code>index.html</code>. See{" "}
          <a href="#publish" className={link}>
            What you can publish
          </a>
          .
        </>
      ),
    },
    {
      q: "Deep links into my app return 404.",
      a: (
        <>
          Your app uses a client-side router (React Router, Vue Router and
          friends), so a URL like <code>/{"<name>"}/settings</code> has no file
          behind it. Turn on <strong>Single-page app</strong> under More options
          (or pass <code>--spa</code>) and Drop serves <code>index.html</code>{" "}
          for unknown routes instead.
        </>
      ),
    },
    {
      q: "My site expired. Is it gone?",
      a: (
        <>
          It stops being served the moment it expires, and the name stays yours.
          The files are kept for {config.expiredRetentionDays} more days, but
          the only way back online is to publish again, which uploads fresh
          files. If you still have the folder, that takes a few seconds. To
          avoid it next time, set a longer expiry or{" "}
          <strong>Never expires</strong> from My Drops at any point before it
          expires.
        </>
      ),
    },
    {
      q: "Who can see what I publish?",
      a: (
        <>
          Anyone who can reach <strong>{sitesHost}</strong>. There is no
          per-site password or sign-in for visitors; the URL is the access
          control. Treat a Drop like a link you would post in a team channel.
        </>
      ),
    },
    {
      q: "How does a coding agent sign in?",
      a: (
        <>
          It doesn&rsquo;t. You run <code>drop login</code> once in a terminal,
          approve it in the browser, and from then on the agent just runs{" "}
          <code>drop deploy</code>. Agents never see a token or a password. If
          an agent reports <code>unauthenticated</code>, run{" "}
          <code>drop login</code> yourself and let it retry.
        </>
      ),
    },
    {
      q: "How do I sign the CLI out?",
      a: (
        <>
          <code>drop logout</code> forgets the credential on that machine. CLI
          sign-ins also expire on their own after {config.cliTokenTtlDays} days,
          after which <code>drop login</code> asks you again.
        </>
      ),
    },
  ]

  return (
    <article className="pt-8 sm:pt-12">
      <h1 className="text-[2rem] leading-tight font-medium tracking-tight text-balance sm:text-[2.5rem]">
        How Drop works
      </h1>
      <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-muted-foreground">
        Drop turns a folder of static files into a URL on the company network.
        You give it the folder and a name; it gives you{" "}
        <span className="text-foreground">{sitesHost}/name/</span>. Nothing to
        configure, no pipeline, no server to look after.
      </p>

      <nav
        aria-label="On this page"
        className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground"
      >
        {[
          ["what", "What it is"],
          ["ways", "Ways to publish"],
          ["names", "Names"],
          ["expiry", "Expiry"],
          ["publish", "What you can publish"],
          ["where", "Where sites live"],
          ["limits", "Limits"],
          ["questions", "Questions"],
        ].map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="rounded-sm underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            {label}
          </a>
        ))}
      </nav>

      <div className="mt-12 space-y-12">
        <Section id="what" title="What it is">
          <p>
            A Drop is a folder of HTML, CSS, JavaScript, images and other files,
            served as a website under a name you choose. Three steps, every
            time:
          </p>
          <ol className="list-decimal space-y-1.5 pl-5 marker:text-foreground/50">
            <li>
              <strong>Drop</strong> a folder, a single HTML file or a .zip.
            </li>
            <li>
              <strong>Name</strong> it. The name is the URL.
            </li>
            <li>
              <strong>Publish.</strong> Share the URL.
            </li>
          </ol>
          <p>
            It is built for the things that come out of everyday work: a
            dashboard, a report exported to HTML, a prototype, a docs build, a
            Vite or Next.js export, something a coding agent just generated.
            Drop serves files and nothing else, so it cannot run a backend, a
            database or server-side code.
          </p>
        </Section>

        <Section id="ways" title="Three ways to publish">
          <p>
            <strong>
              <Link href="/" className={link}>
                The publish page
              </Link>
            </strong>
            . Drag a folder anywhere on it, or click to choose one. Good for a
            one-off.
          </p>
          <p>
            <strong>
              <Link href="/cli" className={link}>
                The CLI
              </Link>
            </strong>
            . One line installs it, one line publishes. Good for anything you
            will publish more than once.
          </p>
          <CopyBlock code={installCommand} />
          <CopyBlock code="drop deploy ./dist --path route-optimizer" />
          <p>
            <strong>A coding agent</strong> (Claude Code, Cursor, Codex).
            Install the CLI, sign in once, and give the agent the{" "}
            <Link href="/cli#agents" className={link}>
              skill or MCP server
            </Link>
            . From then on &ldquo;publish this&rdquo; is enough; it runs{" "}
            <code>drop deploy</code> and hands you the URL.
          </p>
        </Section>

        <Section id="names" title="Names">
          <p>
            The name becomes the URL:{" "}
            <span className="text-foreground">{sitesHost}/</span>
            <strong>route-optimizer</strong>
            <span className="text-foreground">/</span>. Lowercase letters,
            numbers and hyphens, up to 64 characters. Drop suggests one from the
            folder or file name and tidies whatever you type (
            <code>Route Optimizer</code> becomes <code>route-optimizer</code>).
          </p>
          <p>
            <strong>Whoever publishes a name first owns it.</strong>{" "}
            Publishing
            to a name you own replaces the site in place at the same URL.
            Publishing to someone else&rsquo;s name is refused. Deleting a Drop
            frees the name for anyone; expiring does not.
          </p>
          <p>
            Name the thing, not the folder: <code>q3-sales-review</code> beats{" "}
            <code>dashboard</code>, because names are shared across the whole
            company.
          </p>
        </Section>

        <Section id="expiry" title="Expiry">
          <p>
            Drops are temporary unless you say otherwise. A new one expires
            after <strong>{config.defaultExpiryDays} days</strong>; the presets
            are {presets}, and Custom takes any whole number of days up to{" "}
            {MAX_EXPIRY_DAYS}. <strong>Never expires</strong> keeps a site up
            until you delete it.
          </p>
          <p>
            When a Drop expires it stops being served; visitors get a page
            saying nothing is published there. The name stays yours. Publishing
            again brings it back at the same URL. The files are removed after{" "}
            {config.expiredRetentionDays} more days.
          </p>
          <p>
            You can change the expiry at any time, before or after the site
            expires, from{" "}
            <Link href="/drops" className={link}>
              My Drops
            </Link>{" "}
            or the page you see right after publishing. Changing it later never
            resets the files, only the date.
          </p>
        </Section>

        <Section id="publish" title="What you can publish">
          <p>
            <strong>Built output, not source.</strong> Point Drop at the folder
            your build produces (<code>dist</code>, <code>build</code>,{" "}
            <code>out</code>, <code>_site</code>) or at hand-written HTML. It
            must have <code>index.html</code> at the top; that is the page
            visitors land on. If the folder wraps everything in one subfolder,
            Drop looks inside it.
          </p>
          <p>
            <strong>One file is fine.</strong> A single HTML file (a report, a
            rendered notebook, a chart) is published on its own and becomes{" "}
            <code>index.html</code>. A .zip is unpacked and treated like a
            folder.
          </p>
          <p>
            <strong>Assets must be relative.</strong> Sites live under{" "}
            <code>/{"<name>"}/</code>, so{" "}
            <code>&lt;script src=&quot;/app.js&quot;&gt;</code> breaks and{" "}
            <code>&lt;script src=&quot;./app.js&quot;&gt;</code> works. Set this
            in the build, not by hand:
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Framework</TableHead>
                  <TableHead>Setting</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Vite</TableCell>
                  <TableCell className="whitespace-normal">
                    <code>base: &apos;./&apos;</code> in{" "}
                    <code>vite.config.ts</code>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Next.js</TableCell>
                  <TableCell className="whitespace-normal">
                    <code>output: &apos;export&apos;</code>,{" "}
                    <code>basePath: &apos;/{"<name>"}&apos;</code>,{" "}
                    <code>assetPrefix: &apos;/{"<name>"}/&apos;</code>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Astro</TableCell>
                  <TableCell className="whitespace-normal">
                    <code>base: &apos;/{"<name>"}&apos;</code> in{" "}
                    <code>astro.config.mjs</code>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Plain HTML</TableCell>
                  <TableCell className="whitespace-normal">
                    Write <code>./style.css</code>, never{" "}
                    <code>/style.css</code>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <p>
            <strong>Single-page apps.</strong>{" "}
            If your app has a client-side
            router, turn on &ldquo;Single-page app&rdquo; (or <code>--spa</code>
            ) so unknown routes get <code>index.html</code> instead of a 404.
            Leave it off for plain sites, where a real 404 is more useful.
          </p>
          <p>
            Drop skips <code>node_modules</code>, <code>.git</code> and OS junk
            like <code>.DS_Store</code> on the way in, and serves every usual
            file type with the right MIME type: HTML, CSS, JS, JSON, images,
            fonts, WebAssembly, PDF.
          </p>
        </Section>

        <Section id="where" title="Where sites live">
          <p>
            This page and everything you publish are on two different hosts on
            purpose. <strong>{controlHost}</strong> is Drop itself: sign-in,
            publishing, My Drops. <strong>{sitesHost}</strong>{" "}
            serves the
            published files. A site&rsquo;s JavaScript runs on the second host
            and can never reach your Drop session on the first.
          </p>
          <p>
            Published sites have no sign-in of their own. Anyone who can reach{" "}
            {sitesHost} can open them. The URL is the access control, so share
            it the way you would share a link in a team channel.
          </p>
        </Section>

        <Section id="limits" title="Limits">
          <div className="overflow-x-auto">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>Site size</TableCell>
                  <TableCell>{formatBytes(config.maxSiteBytes)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Single file</TableCell>
                  <TableCell>{formatBytes(config.maxFileBytes)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Files per site</TableCell>
                  <TableCell>
                    {config.maxFiles.toLocaleString("en-US")}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Name length</TableCell>
                  <TableCell>64 characters</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Expiry</TableCell>
                  <TableCell className="whitespace-normal">
                    {config.defaultExpiryDays} days by default, up to{" "}
                    {MAX_EXPIRY_DAYS}, or never
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>CLI sign-in</TableCell>
                  <TableCell>
                    {config.cliTokenTtlDays} days, then sign in again
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <p>
            If a folder is over the limit it usually contains something that
            should not ship: source maps, raw data, a stray{" "}
            <code>node_modules</code>.
          </p>
        </Section>

        <Section id="questions" title="Questions">
          <Accordion className="text-foreground">
            {questions.map(({ q, a }) => (
              <AccordionItem key={q} value={q}>
                <AccordionTrigger>{q}</AccordionTrigger>
                <AccordionContent className="text-[15px] leading-relaxed text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground">
                  {a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Section>
      </div>

      <p className="mt-16 text-sm text-muted-foreground">
        Ready?{" "}
        <Link href="/" className={link}>
          Publish something
        </Link>
        .
      </p>
    </article>
  )
}
