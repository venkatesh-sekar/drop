import { Api } from "../api.ts";
import type { ParsedArgs } from "../args.ts";
import { deleteCredential, type DropUser, getCredential, writeConfig } from "../config.ts";
import { CliError } from "../errors.ts";
import { note, out } from "../io.ts";

interface MeResponse {
  user: DropUser;
}

function describe(user: DropUser): string {
  const name = user.display_name ?? "Unknown";
  return user.email ? `${name} <${user.email}>` : name;
}

export async function login(args: ParsedArgs, controlUrl: string): Promise<void> {
  // `drop login --url X` is how you point the CLI at a Drop and make it stick.
  if (args.url) writeConfig({ url: controlUrl });

  if (getCredential(controlUrl)) {
    const api = new Api(controlUrl, { interactive: true });
    try {
      const me = await api.request<MeResponse>("/api/me");
      note(`Already signed in as ${describe(me.user)} (${controlUrl})`);
      return;
    } catch (error) {
      if (!(error instanceof CliError) || error.code === "network_error") throw error;
      deleteCredential(controlUrl);
    }
  }

  // Explicit login always runs the browser flow, TTY or not.
  const api = new Api(controlUrl, { interactive: true });
  await api.authenticate(true);
  const me = await api.request<MeResponse>("/api/me");
  out(`Signed in as ${describe(me.user)} (${controlUrl})`);
}

export function logout(controlUrl: string): void {
  const removed = deleteCredential(controlUrl);
  out(removed ? `Logged out of ${controlUrl}.` : `Not signed in to ${controlUrl}.`);
}

export async function whoami(args: ParsedArgs, controlUrl: string): Promise<void> {
  const notSignedIn = new CliError("unauthenticated", "Not signed in. Run: drop login");
  const api = new Api(controlUrl, { interactive: false });
  if (!api.hasToken()) throw notSignedIn;

  let me: MeResponse;
  try {
    me = await api.request<MeResponse>("/api/me");
  } catch (error) {
    if (error instanceof CliError && error.code === "unauthenticated") throw notSignedIn;
    throw error;
  }

  if (args.json) {
    out(JSON.stringify({ user: me.user, url: controlUrl }));
    return;
  }
  out(`Signed in as ${describe(me.user)} (${controlUrl})`);
}
