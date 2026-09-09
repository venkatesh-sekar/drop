import { pollCliAuthRequest } from "@drop/core"
import { error, json, readJson } from "@/lib/api"

/** Device-flow step 3. Returns the token exactly once, then only `expired`. */
export async function POST(request: Request): Promise<Response> {
  const body = await readJson(request)
  const code = typeof body.code === "string" ? body.code : ""
  if (!code) return error("invalid_request", "Send the code you got from /api/cli/auth/start.", 400)

  const result = await pollCliAuthRequest(code)
  if (result.status !== "approved") return json({ status: result.status })

  return json({
    status: "approved",
    token: result.token,
    user: {
      id: result.user.id,
      display_name: result.user.display_name,
      email: result.user.email,
    },
  })
}
