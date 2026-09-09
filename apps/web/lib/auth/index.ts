import { config, isAdmin, verifyCliToken, type User } from "@drop/core"
import type { AuthProvider } from "./provider"
import { mockProvider } from "./mock"
import { oidcProvider } from "./oidc"
import { getSessionUserFromRequest } from "./session"

export * from "./provider"
export * from "./session"

export function authProvider(): AuthProvider {
  return config.authProvider === "oidc" ? oidcProvider : mockProvider
}

/**
 * The caller of an API request: browser session cookie, or a `drop_…` bearer token.
 * Returns null when neither identifies a user.
 */
export async function currentApiUser(request: Request): Promise<User | null> {
  const authorization = request.headers.get("authorization")
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    const token = authorization.slice(7).trim()
    const user = await verifyCliToken(token)
    if (user) return user
  }
  return getSessionUserFromRequest(request)
}

export function userIsAdmin(user: User | null | undefined): boolean {
  return isAdmin(user, config)
}
