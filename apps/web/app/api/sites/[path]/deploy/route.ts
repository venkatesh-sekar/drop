import {
  ArchiveError,
  SiteError,
  config,
  createStorage,
  deploySite,
  toSiteJson,
  validateArchive,
  validatePath,
  type Expiry,
} from "@drop/core"
import { error, json, withUser } from "@/lib/api"

type Ctx = { params: Promise<{ path: string }> }

/** Large uploads: give the handler room on platforms that enforce a limit. */
export const maxDuration = 300

function siteErrorStatus(code: SiteError["code"]): number {
  if (code === "path_taken") return 409
  if (code === "not_found") return 404
  return 400
}

export const POST = withUser<Ctx>(async (request, user, { params }) => {
  const { path: rawPath } = await params

  const validated = validatePath(decodeURIComponent(rawPath))
  if (!validated.ok) return error(validated.error, validated.message, 400)
  const path = validated.path

  // Reject an oversized upload from the headers before buffering the whole body.
  const declared = Number(request.headers.get("content-length") ?? "")
  if (Number.isFinite(declared) && declared > config.maxArchiveBytes) {
    return error(
      "archive_too_large",
      `That upload is over the ${Math.round(config.maxArchiveBytes / (1024 * 1024))} MB limit.`,
      400,
    )
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return error("invalid_archive", "Send the site as multipart/form-data with an `archive` file.", 400)
  }

  const archive = form.get("archive")
  if (!archive || typeof archive === "string") {
    return error("invalid_archive", "Missing the `archive` file field.", 400)
  }
  if (archive.size > config.maxArchiveBytes) {
    return error(
      "archive_too_large",
      `That upload is over the ${Math.round(config.maxArchiveBytes / (1024 * 1024))} MB limit.`,
      400,
    )
  }

  const expiryRaw = form.get("expiry")
  let expiry: Expiry | undefined
  if (typeof expiryRaw === "string" && expiryRaw !== "") {
    if (expiryRaw !== "30d" && expiryRaw !== "never") {
      return error("invalid_expiry", 'expiry must be "30d" or "never".', 400)
    }
    expiry = expiryRaw
  }

  const spaRaw = form.get("spa")
  const spa = typeof spaRaw === "string" && spaRaw !== "" ? spaRaw === "true" : undefined

  const bytes = new Uint8Array(await archive.arrayBuffer())

  let files
  let warnings: string[]
  try {
    const result = validateArchive(bytes)
    files = result.files
    warnings = result.warnings
  } catch (err) {
    if (err instanceof ArchiveError) return error(err.code, err.message, 400)
    throw err
  }

  try {
    const result = await deploySite({
      path,
      userId: user.id,
      files,
      expiry,
      spa,
      warnings,
      storage: createStorage(),
    })
    const site = toSiteJson(result.site)
    return json({ url: site.url, path: site.path, site, warnings: result.warnings })
  } catch (err) {
    if (err instanceof SiteError) return error(err.code, err.message, siteErrorStatus(err.code))
    throw err
  }
})
