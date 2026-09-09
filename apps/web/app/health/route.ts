export const dynamic = "force-dynamic"

/** Liveness only: never touches the database. */
export async function GET(): Promise<Response> {
  return Response.json({ ok: true })
}
