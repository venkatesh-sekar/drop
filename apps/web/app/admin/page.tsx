import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { getSessionUser, userIsAdmin } from "@/lib/auth"
import { AdminSearch } from "@/components/admin-search"

export const metadata: Metadata = { title: "Admin · Drop" }

export default async function AdminPage() {
  const user = await getSessionUser()
  if (!user) redirect(`/auth/login?next=${encodeURIComponent("/admin")}`)
  // Non-admins are told nothing more than that this page does not exist.
  if (!userIsAdmin(user)) notFound()

  return (
    <section className="pt-8 sm:pt-12">
      <h1 className="text-[2rem] leading-tight font-medium tracking-tight sm:text-[2.5rem]">
        Admin
      </h1>
      <p className="mt-4 text-[15px] text-muted-foreground">
        Find a Drop by path, owner name or email. Expire takes it offline and keeps the path with
        its owner. Release deletes it and frees the path for anyone.
      </p>
      <AdminSearch />
    </section>
  )
}
