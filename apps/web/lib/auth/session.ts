import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { SignJWT, jwtVerify } from "jose"
import { config, findUserById, type User } from "@drop/core"

export const SESSION_COOKIE = "drop_session"

const SESSION_DAYS = 7
const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60

function secret(): Uint8Array {
  return new TextEncoder().encode(config.sessionSecret)
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: config.controlUrl.startsWith("https://"),
    path: "/",
    maxAge: SESSION_MAX_AGE,
  }
}

/** Signed session token holding nothing but the user id. */
export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret())
}

export async function readSessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    return typeof payload.sub === "string" ? payload.sub : null
  } catch {
    return null
  }
}

/** Redirect that also signs the user in. */
export async function redirectWithSession(to: URL, userId: string): Promise<NextResponse> {
  const response = NextResponse.redirect(to, 303)
  response.cookies.set(SESSION_COOKIE, await createSessionToken(userId), cookieOptions())
  return response
}

/** Redirect that also signs the user out. */
export function redirectWithoutSession(to: URL): NextResponse {
  const response = NextResponse.redirect(to, 303)
  response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(), maxAge: 0 })
  return response
}

/** The signed-in user for the current request, or null. */
export async function getSessionUser(): Promise<User | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null
  const userId = await readSessionToken(token)
  if (!userId) return null
  return findUserById(userId)
}

/** Session lookup for a Request that carries its own cookies (route handlers). */
export async function getSessionUserFromRequest(request: Request): Promise<User | null> {
  const header = request.headers.get("cookie")
  if (!header) return null
  const token = parseCookie(header, SESSION_COOKIE)
  if (!token) return null
  const userId = await readSessionToken(token)
  if (!userId) return null
  return findUserById(userId)
}

function parseCookie(header: string, name: string): string | null {
  for (const part of header.split(";")) {
    const eq = part.indexOf("=")
    if (eq === -1) continue
    if (part.slice(0, eq).trim() !== name) continue
    return decodeURIComponent(part.slice(eq + 1).trim())
  }
  return null
}
