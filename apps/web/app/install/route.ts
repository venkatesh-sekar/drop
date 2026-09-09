import { installScript } from "@/lib/dist"

/**
 * `curl -fsSL <control>/install | sh` — the install script, with this Drop's URL
 * baked in. Plain text so a browser shows it and `sh` runs it.
 */
export async function GET(): Promise<Response> {
  const script = await installScript()
  if (!script) {
    return new Response("The install script is missing from this build.\n", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    })
  }
  return new Response(script, {
    headers: {
      "content-type": "text/x-shellscript; charset=utf-8",
      "cache-control": "no-cache",
    },
  })
}
