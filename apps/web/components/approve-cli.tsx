"use client"

import * as React from "react"
import { Button } from "@workspace/ui/components/button"

export function ApproveCli({
  code,
  hostname,
  email,
  ttlDays,
}: {
  code: string
  hostname: string
  email: string
  /** How long the credential the CLI receives stays valid. */
  ttlDays: number
}) {
  const [state, setState] = React.useState<"asking" | "busy" | "approved" | "denied">("asking")
  const [failure, setFailure] = React.useState<string | null>(null)

  async function answer(approve: boolean) {
    setState("busy")
    setFailure(null)
    const response = await fetch("/api/cli/auth/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, approve }),
    })
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null
      setFailure(body?.message ?? "That did not work. Run the command again.")
      setState("asking")
      return
    }
    setState(approve ? "approved" : "denied")
  }

  if (state === "approved") {
    return (
      <section className="pt-16 sm:pt-24">
        <h1 className="text-[2rem] leading-tight font-medium tracking-tight sm:text-[2.5rem]">
          The CLI is signed in.
        </h1>
        <p className="mt-4 text-[15px] text-muted-foreground">You can return to your terminal.</p>
      </section>
    )
  }

  if (state === "denied") {
    return (
      <section className="pt-16 sm:pt-24">
        <h1 className="text-[2rem] leading-tight font-medium tracking-tight sm:text-[2.5rem]">
          Denied.
        </h1>
        <p className="mt-4 text-[15px] text-muted-foreground">
          That terminal did not get access. You can close this page.
        </p>
      </section>
    )
  }

  return (
    <section className="pt-16 sm:pt-24">
      <h1 className="text-[2rem] leading-tight font-medium tracking-tight text-balance sm:text-[2.5rem]">
        Sign in to the Drop CLI on {hostname}?
      </h1>
      <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-muted-foreground">
        A terminal on {hostname} ran <code>drop login</code>. Approving lets the <code>drop</code>{" "}
        command on that machine publish and manage Drops as {email} for {ttlDays} days, or until{" "}
        <code>drop logout</code> is run there. Nothing else on that machine gets access, and no
        password is shared.
      </p>

      <p className="mt-10 text-3xl font-medium tracking-[0.12em] tabular-nums sm:text-4xl">
        {code}
      </p>
      <p className="mt-2 text-[13px] text-muted-foreground">
        Approve only if this matches the code in your terminal.
      </p>

      <div className="mt-9 flex flex-wrap items-center gap-3">
        <Button disabled={state === "busy"} onClick={() => void answer(true)}>
          Approve
        </Button>
        <Button variant="outline" disabled={state === "busy"} onClick={() => void answer(false)}>
          Deny
        </Button>
      </div>

      {failure ? <p className="mt-6 text-sm text-destructive">{failure}</p> : null}
    </section>
  )
}
