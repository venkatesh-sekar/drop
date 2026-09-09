import { config } from "@drop/core"
import type { AuthProvider, Identity } from "./provider"
import { safeNext } from "./provider"

/**
 * Development identity provider: a form that takes a name and an email, no secrets.
 * The identity is `mock:<email>` so the same email always maps to the same user.
 */
export const mockProvider: AuthProvider = {
  async loginRedirect(next: string): Promise<Response> {
    const url = new URL("/auth/mock", config.controlUrl)
    url.searchParams.set("next", safeNext(next))
    return Response.redirect(url, 302)
  },

  async handleCallback(request: Request): Promise<Identity> {
    const form = await request.formData()
    const email = String(form.get("email") ?? "").trim().toLowerCase()
    const displayName = String(form.get("name") ?? "").trim()
    if (!email || !email.includes("@")) throw new Error("A valid email is required.")
    return {
      externalUserId: `mock:${email}`,
      displayName: displayName || email.split("@")[0]!,
      email,
    }
  },
}
