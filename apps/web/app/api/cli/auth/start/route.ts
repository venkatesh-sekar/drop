import { config, createCliAuthRequest } from "@drop/core"
import { json, readJson } from "@/lib/api"

/** Device-flow step 1. Deliberately unauthenticated: the browser leg proves identity. */
export async function POST(request: Request): Promise<Response> {
  const body = await readJson(request)
  const hostname =
    typeof body.hostname === "string" && body.hostname.trim() !== ""
      ? body.hostname.trim().slice(0, 128)
      : undefined

  const { code, expiresAt } = await createCliAuthRequest(hostname)
  return json({
    code,
    verify_url: `${config.controlUrl}/cli/authorize?code=${encodeURIComponent(code)}`,
    poll_interval: 2,
    expires_in: Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 1000)),
  })
}
