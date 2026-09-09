import { config, mintCliTokenForUser, upsertUser } from "@drop/core"
import { error, json, notFound, readJson } from "@/lib/api"

/** Development convenience: mint a CLI token without a browser. Mock provider only. */
export async function POST(request: Request): Promise<Response> {
  if (config.authProvider !== "mock") return notFound()

  const body = await readJson(request)
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  if (!email || !email.includes("@")) {
    return error("invalid_request", "Send an email address.", 400)
  }
  const displayName =
    typeof body.display_name === "string" && body.display_name.trim() !== ""
      ? body.display_name.trim()
      : email.split("@")[0]!

  const user = await upsertUser({ externalUserId: `mock:${email}`, displayName, email })
  const token = await mintCliTokenForUser(user.id, "dev-token")
  return json({ token })
}
