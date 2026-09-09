import { config } from "@drop/core"
import { redirectWithoutSession } from "@/lib/auth"

export async function POST(): Promise<Response> {
  return redirectWithoutSession(new URL("/", config.controlUrl))
}
