import {
  SiteError,
  createStorage,
  deleteSite,
  findSiteByPath,
  normalizePath,
  toSiteJson,
  updateSite,
  type Expiry,
} from "@drop/core"
import { error, json, notFound, readJson, withUser } from "@/lib/api"
import { userIsAdmin } from "@/lib/auth"

type Ctx = { params: Promise<{ path: string }> }

const EXPIRY_VALUES = new Set(["30d", "never"])

export const GET = withUser<Ctx>(async (_request, user, { params }) => {
  const { path } = await params
  const site = await findSiteByPath(normalizePath(path))
  if (!site) return notFound("No site at that path.")
  if (site.owner_user_id !== user.id && !userIsAdmin(user)) return notFound("No site at that path.")
  return json({ site: toSiteJson(site) })
})

export const PATCH = withUser<Ctx>(async (request, user, { params }) => {
  const { path } = await params
  const body = await readJson(request)

  let expiry: Expiry | undefined
  if (body.expiry !== undefined) {
    if (typeof body.expiry !== "string" || !EXPIRY_VALUES.has(body.expiry)) {
      return error("invalid_expiry", 'expiry must be "30d" or "never".', 400)
    }
    expiry = body.expiry as Expiry
  }

  let spa: boolean | undefined
  if (body.spa !== undefined) {
    if (typeof body.spa !== "boolean") return error("invalid_spa", "spa must be true or false.", 400)
    spa = body.spa
  }

  if (expiry === undefined && spa === undefined) {
    return error("nothing_to_update", "Send expiry, spa, or both.", 400)
  }

  try {
    const site = await updateSite(normalizePath(path), user.id, { expiry, spa })
    return json({ site: toSiteJson(site) })
  } catch (err) {
    if (err instanceof SiteError) return error(err.code, err.message, err.code === "not_found" ? 404 : 400)
    throw err
  }
})

export const DELETE = withUser<Ctx>(async (_request, user, { params }) => {
  const { path } = await params
  const site = await findSiteByPath(normalizePath(path))
  if (!site) return notFound("No site at that path.")
  if (site.owner_user_id !== user.id && !userIsAdmin(user)) return notFound("No site at that path.")

  await deleteSite(site.id, createStorage())
  return new Response(null, { status: 204 })
})
