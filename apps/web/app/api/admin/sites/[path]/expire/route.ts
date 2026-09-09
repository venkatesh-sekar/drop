import { SiteError, adminExpireSite, normalizePath, toSiteJson } from "@drop/core"
import { error, json, withAdmin } from "@/lib/api"

type Ctx = { params: Promise<{ path: string }> }

export const POST = withAdmin<Ctx>(async (_request, _user, { params }) => {
  const { path } = await params
  try {
    const site = await adminExpireSite(normalizePath(path))
    return json({ site: toSiteJson(site) })
  } catch (err) {
    if (err instanceof SiteError) return error(err.code, err.message, 404)
    throw err
  }
})
