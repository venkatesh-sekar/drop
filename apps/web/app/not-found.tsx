import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "Not found · Drop" }

export default function NotFound() {
  return (
    <section className="pt-16 sm:pt-24">
      <h1 className="text-[2rem] leading-tight font-medium tracking-tight sm:text-[2.5rem]">
        Nothing here.
      </h1>
      <p className="mt-4 text-[15px] text-muted-foreground">
        This page does not exist. Published sites live on their own host, not this one.
      </p>
      <p className="mt-8 text-sm">
        <Link
          href="/"
          className="rounded-sm underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          Publish something
        </Link>
      </p>
    </section>
  )
}
