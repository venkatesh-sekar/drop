import { config, upsertUser } from "@drop/core"
import { authProvider, redirectWithSession, safeNext } from "@/lib/auth"
import { pendingNext } from "@/lib/auth/oidc"

/** The provider sends the browser back here. Identity in, session cookie out. */
export async function GET(request: Request): Promise<Response> {
  const next =
    config.authProvider === "oidc"
      ? await pendingNext()
      : safeNext(new URL(request.url).searchParams.get("next"))

  const identity = await authProvider().handleCallback(request)
  const user = await upsertUser(identity)
  return redirectWithSession(new URL(next, config.controlUrl), user.id)
}
