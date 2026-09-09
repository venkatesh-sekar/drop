import { config, normalizePath } from "@drop/core"

import { getSessionUser } from "@/lib/auth"
import { Publisher } from "@/components/publisher"

export default async function PublishPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string | string[] }>
}) {
  const user = await getSessionUser()
  const params = await searchParams
  const raw = Array.isArray(params.path) ? params.path[0] : params.path
  const initialPath = raw ? normalizePath(raw) : ""

  return (
    <Publisher
      sitesHost={new URL(config.sitesUrl).host}
      signedIn={Boolean(user)}
      initialPath={initialPath}
    />
  )
}
