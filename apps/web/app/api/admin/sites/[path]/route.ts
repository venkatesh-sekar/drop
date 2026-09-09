import { createStorage, deleteSite, findSiteByPath, normalizePath } from "@drop/core"
import { notFound, withAdmin } from "@/lib/api"

type Ctx = { params: Promise<{ path: string }> }

/** Release a path: delete the row and its files so anyone can claim it again. */
export const DELETE = withAdmin<Ctx>(async (_request, _user, { params }) => {
  const { path } = await params
  const site = await findSiteByPath(normalizePath(path))
  if (!site) return notFound("No site at that path.")
  await deleteSite(site.id, createStorage())
  return new Response(null, { status: 204 })
})
