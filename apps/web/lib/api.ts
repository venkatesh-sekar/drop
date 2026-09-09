import type { User } from "@drop/core"
import { currentApiUser, userIsAdmin } from "@/lib/auth"

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status })
}

/** The one error shape the whole API speaks: { error, message }. */
export function error(code: string, message: string, status: number): Response {
  return Response.json({ error: code, message }, { status })
}

export const unauthenticated = () =>
  error("unauthenticated", "Sign in, or use a CLI token.", 401)

export const notFound = (message = "Not found.") => error("not_found", message, 404)

export type UserHandler<Ctx> = (
  request: Request,
  user: User,
  context: Ctx,
) => Promise<Response> | Response

/** Wrap a route handler so it only runs for an authenticated caller. */
export function withUser<Ctx>(handler: UserHandler<Ctx>) {
  return async (request: Request, context: Ctx): Promise<Response> => {
    const user = await currentApiUser(request)
    if (!user) return unauthenticated()
    return handler(request, user, context)
  }
}

/** Same, but the caller must be an admin. Non-admins get a 404, not a hint. */
export function withAdmin<Ctx>(handler: UserHandler<Ctx>) {
  return withUser<Ctx>(async (request, user, context) => {
    if (!userIsAdmin(user)) return notFound()
    return handler(request, user, context)
  })
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json()
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}
