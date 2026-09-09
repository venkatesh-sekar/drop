import { getCliAuthRequest } from "@drop/core"
import { json, notFound, withUser } from "@/lib/api"

type Ctx = { params: Promise<{ code: string }> }

/** What the authorize page shows the human before they approve. */
export const GET = withUser<Ctx>(async (_request, _user, { params }) => {
  const { code } = await params
  const request = await getCliAuthRequest(decodeURIComponent(code))
  if (!request) return notFound("That code is not a sign-in request. Check the terminal.")

  const expired =
    request.status === "pending" && new Date(request.expires_at).getTime() < Date.now()

  return json({
    hostname: request.hostname,
    created_at: new Date(request.created_at).toISOString(),
    status: expired ? "expired" : request.status,
  })
})
