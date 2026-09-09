import { authProvider, safeNext } from "@/lib/auth"

export async function GET(request: Request): Promise<Response> {
  const next = safeNext(new URL(request.url).searchParams.get("next"))
  return authProvider().loginRedirect(next)
}
