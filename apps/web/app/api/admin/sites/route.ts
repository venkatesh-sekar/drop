import { adminSearchSites, toSiteJson } from "@drop/core"
import { json, withAdmin } from "@/lib/api"

export const GET = withAdmin(async (request) => {
  const q = new URL(request.url).searchParams.get("q") ?? ""
  const rows = await adminSearchSites(q)
  return json({
    sites: rows.map((row) => ({ ...toSiteJson(row), owner: row.owner })),
  })
})
