import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getCliAuthRequest } from "@drop/core"

import { getSessionUser } from "@/lib/auth"
import { ApproveCli } from "@/components/approve-cli"

export const metadata: Metadata = { title: "Authorize the CLI · Drop" }

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] }>
}) {
  const params = await searchParams
  const raw = Array.isArray(params.code) ? params.code[0] : params.code
  const code = (raw ?? "").trim().toUpperCase()

  const user = await getSessionUser()
  if (!user) {
    redirect(`/auth/login?next=${encodeURIComponent(`/cli/authorize?code=${code}`)}`)
  }

  // Read the request directly rather than calling our own API over HTTP.
  const request = code ? await getCliAuthRequest(code) : null

  if (!request) return <Unavailable title="We don't know that code." />

  if (request.status === "denied") {
    return <Unavailable title="That sign-in was denied." />
  }
  if (request.status === "approved") {
    return (
      <Unavailable title="That terminal is already signed in." body="You can return to it." />
    )
  }
  // eslint-disable-next-line react-hooks/purity -- the request-time clock is the point.
  if (new Date(request.expires_at).getTime() < Date.now()) {
    return (
      <Unavailable
        title="That sign-in request expired."
        body="Run the command again to start a new one."
      />
    )
  }

  return (
    <ApproveCli
      code={request.code}
      hostname={request.hostname ?? "an unnamed machine"}
      email={user.email}
    />
  )
}

function Unavailable({ title, body }: { title: string; body?: string }) {
  return (
    <section className="pt-16 sm:pt-24">
      <h1 className="text-[2rem] leading-tight font-medium tracking-tight sm:text-[2.5rem]">
        {title}
      </h1>
      <p className="mt-4 text-[15px] text-muted-foreground">
        {body ?? "Check the code in your terminal, or run the command again."}
      </p>
      <p className="mt-8 text-sm">
        <Link
          href="/cli"
          className="rounded-sm underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          CLI setup
        </Link>
      </p>
    </section>
  )
}
