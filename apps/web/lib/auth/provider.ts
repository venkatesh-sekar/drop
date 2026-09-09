export interface Identity {
  externalUserId: string
  displayName: string
  email: string
}

export interface AuthProvider {
  /** Send the browser wherever sign-in happens. `next` is a relative path. */
  loginRedirect(next: string): Promise<Response>
  /** Turn the provider's callback request into an identity. */
  handleCallback(request: Request): Promise<Identity>
}

/** Only same-origin relative paths are accepted as post-login destinations. */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next) return fallback
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback
  return next
}
