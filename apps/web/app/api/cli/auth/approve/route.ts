import { approveCliAuthRequest, denyCliAuthRequest } from "@drop/core"
import { error, json, readJson, withUser } from "@/lib/api"

const MESSAGES: Record<string, string> = {
  not_found: "That code is not a sign-in request. Check the terminal.",
  expired: "That sign-in request expired. Run the command again.",
  already_used: "That sign-in request was already answered.",
}

/** Device-flow step 2: the signed-in human approves or denies the terminal. */
export const POST = withUser(async (request, user) => {
  const body = await readJson(request)
  const code = typeof body.code === "string" ? body.code : ""
  if (!code) return error("invalid_request", "Send the code shown in the terminal.", 400)

  if (body.approve === false) {
    const denied = await denyCliAuthRequest(code)
    if (!denied.ok) return error("not_found", MESSAGES.not_found!, 404)
    return json({ ok: true })
  }

  const result = await approveCliAuthRequest(code, user.id)
  if (!result.ok) {
    return error(result.error, MESSAGES[result.error]!, result.error === "not_found" ? 404 : 400)
  }
  return json({ ok: true })
})
