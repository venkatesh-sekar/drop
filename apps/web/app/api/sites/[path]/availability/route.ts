import { findSiteByPath, toSiteJson, validatePath } from "@drop/core"
import { error, json, withUser } from "@/lib/api"

type Ctx = { params: Promise<{ path: string }> }

export type Availability = "free" | "yours" | "taken"

/**
 * Whether a path can be published to by the caller, so the publish page can say
 * "taken" or "replaces your Drop" before a large upload starts. Paths are public
 * URLs already, so revealing that one exists gives nothing away.
 */
export const GET = withUser<Ctx>(async (_request, user, { params }) => {
  const { path: rawPath } = await params
  const validated = validatePath(decodeURIComponent(rawPath))
  if (!validated.ok) return error(validated.error, validated.message, 400)

  const site = await findSiteByPath(validated.path)
  const availability: Availability = !site
    ? "free"
    : site.owner_user_id === user.id
      ? "yours"
      : "taken"

  return json({
    path: validated.path,
    availability,
    site: availability === "yours" && site ? toSiteJson(site) : null,
  })
})
