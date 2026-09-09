import { config, upsertUser } from "@drop/core"
import { authProvider, redirectWithSession, safeNext } from "@/lib/auth"

/**
 * The mock provider's callback. It lives at /auth/mock/submit rather than /auth/mock
 * because App Router forbids a route.ts beside the page.tsx that renders the form.
 */
export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const form = await request.clone().formData().catch(() => null)
  const next = safeNext(
    (form?.get("next") as string | null) || url.searchParams.get("next"),
  )

  let identity
  try {
    identity = await authProvider().handleCallback(request)
  } catch {
    const back = new URL("/auth/mock", config.controlUrl)
    back.searchParams.set("next", next)
    back.searchParams.set("error", "email")
    return Response.redirect(back, 303)
  }

  const user = await upsertUser(identity)
  return redirectWithSession(new URL(next, config.controlUrl), user.id)
}
