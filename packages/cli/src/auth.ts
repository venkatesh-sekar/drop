import { hostname } from "node:os";
import { openInBrowser } from "./browser.ts";
import { type Credential, type DropUser, saveCredential } from "./config.ts";
import { CliError } from "./errors.ts";
import { note } from "./io.ts";

interface StartResponse {
  code: string;
  verify_url: string;
  poll_interval?: number;
  expires_in?: number;
}

interface PollResponse {
  status: "pending" | "approved" | "denied" | "expired";
  token?: string;
  user?: DropUser;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new CliError(
      "network_error",
      `Cannot reach Drop at ${new URL(url).origin}: ${(error as Error).message}`,
    );
  }
  if (!response.ok) {
    throw new CliError("auth_failed", `Authentication failed (HTTP ${response.status}).`);
  }
  return (await response.json()) as T;
}

/**
 * Device-code login: start a request, send the human to the browser, poll until
 * they approve. All human text goes to stderr so --json stdout stays clean.
 */
export async function deviceLogin(controlUrl: string): Promise<Credential> {
  const start = await postJson<StartResponse>(`${controlUrl}/api/cli/auth/start`, {
    hostname: hostname(),
  });

  note("Authentication required.");
  note("Opening browser...");
  note("");
  note(`  ${start.verify_url}`);
  note("");
  note(`If the browser didn't open, visit: ${start.verify_url}`);

  openInBrowser(start.verify_url);

  const intervalMs = Math.max(1, start.poll_interval ?? 2) * 1000;
  const deadline = Date.now() + Math.max(30, start.expires_in ?? 600) * 1000;

  for (;;) {
    await sleep(intervalMs);
    const poll = await postJson<PollResponse>(`${controlUrl}/api/cli/auth/poll`, {
      code: start.code,
    });

    if (poll.status === "approved") {
      if (!poll.token) throw new CliError("auth_failed", "Drop approved the login but returned no token.");
      const credential: Credential = {
        token: poll.token,
        user: poll.user,
        created_at: new Date().toISOString(),
      };
      saveCredential(controlUrl, credential);
      const who = poll.user?.display_name ?? poll.user?.email ?? "you";
      note(`Signed in as ${who}.`);
      return credential;
    }
    if (poll.status === "denied") throw new CliError("auth_denied", "Login was denied in the browser.");
    if (poll.status === "expired") throw new CliError("auth_expired", "Login request expired. Try again.");

    if (Date.now() > deadline) {
      throw new CliError("auth_expired", "Timed out waiting for browser approval.");
    }
  }
}
