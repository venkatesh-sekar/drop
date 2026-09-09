import { INSTALL_ASSETS, readRepoFile } from "@/lib/dist"

type Ctx = { params: Promise<{ asset: string }> }

/**
 * The files the install script downloads (drop.js, drop-mcp.js) and the agent
 * skill (SKILL.md). Anything else is a 404 rather than a directory listing.
 */
export async function GET(
  _request: Request,
  { params }: Ctx
): Promise<Response> {
  const { asset } = await params
  const entry = INSTALL_ASSETS[asset]
  if (!entry) return new Response("Not found.\n", { status: 404 })

  const body = await readRepoFile(entry.file)
  if (!body) {
    return new Response(
      `${asset} is not built on this server. Run: ${entry.build}\n`,
      {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8" },
      }
    )
  }
  return new Response(new Uint8Array(body), {
    headers: {
      "content-type": entry.contentType,
      "content-length": String(body.byteLength),
      "cache-control": "no-cache",
    },
  })
}
