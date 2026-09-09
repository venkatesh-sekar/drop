import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { listSitesForUser, toSiteJson } from "@drop/core"

import { getSessionUser } from "@/lib/auth"
import { expiryLabel, timeAgo } from "@/lib/time"
import { DropsList, type DropRow } from "@/components/drops-list"

export const metadata: Metadata = { title: "My Drops · Drop" }

export default async function DropsPage() {
  const user = await getSessionUser()
  if (!user) redirect(`/auth/login?next=${encodeURIComponent("/drops")}`)

  const sites = await listSitesForUser(user.id)
  // Request-time only: relative times are rendered once here and shipped as strings.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const rows: DropRow[] = sites.map((site) => {
    const json = toSiteJson(site)
    return {
      path: json.path,
      url: json.url,
      status: json.status,
      permanent: json.expires_at === null,
      // Rendered on the server so the list never shifts between server and client.
      updated: `Updated ${timeAgo(json.last_deployed_at ?? json.updated_at, now)}`,
      expiry: expiryLabel(json.expires_at, json.status, now),
    }
  })

  return (
    <section className="pt-8 sm:pt-12">
      <h1 className="text-[2rem] leading-tight font-medium tracking-tight sm:text-[2.5rem]">
        My Drops
      </h1>

      {rows.length === 0 ? (
        <p className="mt-8 text-[15px] text-muted-foreground">
          No Drops yet.{" "}
          <Link
            href="/"
            className="rounded-sm text-foreground underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            Publish your first one.
          </Link>
        </p>
      ) : (
        <DropsList rows={rows} />
      )}
    </section>
  )
}
