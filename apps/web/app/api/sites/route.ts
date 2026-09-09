import { listSitesForUser, toSiteJson } from "@drop/core"
import { json, withUser } from "@/lib/api"

export const GET = withUser(async (_request, user) => {
  const sites = await listSitesForUser(user.id)
  return json({ sites: sites.map((site) => toSiteJson(site)) })
})
