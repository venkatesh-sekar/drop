import { cookies } from "next/headers"
import * as client from "openid-client"
import { config } from "@drop/core"
import type { AuthProvider, Identity } from "./provider"
import { safeNext } from "./provider"

const STATE_COOKIE = "drop_oidc"
const STATE_TTL_SECONDS = 10 * 60

interface PendingLogin {
  verifier: string
  state: string
  nonce: string
  next: string
}

function redirectUri(): string {
  return `${config.controlUrl}/auth/callback`
}

let discovered: Promise<client.Configuration> | undefined

function discover(): Promise<client.Configuration> {
  if (!discovered) {
    if (!config.oidcIssuer || !config.oidcClientId) {
      throw new Error("OIDC_ISSUER and OIDC_CLIENT_ID must be set when AUTH_PROVIDER=oidc.")
    }
    discovered = client.discovery(
      new URL(config.oidcIssuer),
      config.oidcClientId,
      config.oidcClientSecret || undefined,
    )
  }
  return discovered
}

async function setPending(pending: PendingLogin): Promise<void> {
  const store = await cookies()
  store.set(STATE_COOKIE, JSON.stringify(pending), {
    httpOnly: true,
    sameSite: "lax",
    secure: config.controlUrl.startsWith("https://"),
    path: "/",
    maxAge: STATE_TTL_SECONDS,
  })
}

async function takePending(): Promise<PendingLogin | null> {
  const store = await cookies()
  const raw = store.get(STATE_COOKIE)?.value
  store.set(STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: config.controlUrl.startsWith("https://"),
    path: "/",
    maxAge: 0,
  })
  if (!raw) return null
  try {
    return JSON.parse(raw) as PendingLogin
  } catch {
    return null
  }
}

/** Authorization code flow with PKCE. State and nonce live in a short-lived cookie. */
export const oidcProvider: AuthProvider = {
  async loginRedirect(next: string): Promise<Response> {
    const configuration = await discover()
    const verifier = client.randomPKCECodeVerifier()
    const challenge = await client.calculatePKCECodeChallenge(verifier)
    const state = client.randomState()
    const nonce = client.randomNonce()

    await setPending({ verifier, state, nonce, next: safeNext(next) })

    const url = client.buildAuthorizationUrl(configuration, {
      redirect_uri: redirectUri(),
      scope: "openid profile email",
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
      nonce,
    })
    return Response.redirect(url.href, 302)
  },

  async handleCallback(request: Request): Promise<Identity> {
    const configuration = await discover()
    const pending = await takePending()
    if (!pending) throw new Error("Sign-in expired. Start again.")

    const tokens = await client.authorizationCodeGrant(configuration, new URL(request.url), {
      pkceCodeVerifier: pending.verifier,
      expectedState: pending.state,
      expectedNonce: pending.nonce,
    })

    const claims = tokens.claims()
    if (!claims?.sub) throw new Error("The identity provider returned no subject claim.")
    const email = typeof claims.email === "string" ? claims.email : ""
    const name = typeof claims.name === "string" ? claims.name : ""
    return {
      externalUserId: `oidc:${claims.sub}`,
      displayName: name || email || String(claims.sub),
      email: email.toLowerCase(),
    }
  },
}

/** The `next` the browser started from, recovered on the callback leg. */
export async function pendingNext(): Promise<string> {
  const store = await cookies()
  const raw = store.get(STATE_COOKIE)?.value
  if (!raw) return "/"
  try {
    return safeNext((JSON.parse(raw) as PendingLogin).next)
  } catch {
    return "/"
  }
}
