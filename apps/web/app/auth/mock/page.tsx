import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { config } from "@drop/core"

import { safeNext } from "@/lib/auth"
import { MockSignIn } from "@/components/mock-sign-in"

export const metadata: Metadata = { title: "Sign in · Drop" }

export default async function MockAuthPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>
}) {
  if (config.authProvider !== "mock") notFound()

  const params = await searchParams
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next
  const hasError = Boolean(params.error)

  return <MockSignIn next={safeNext(rawNext)} hasError={hasError} />
}
