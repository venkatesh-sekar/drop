import { deviceLogin } from "./auth.ts";
import { deleteCredential, getToken } from "./config.ts";
import { CliError } from "./errors.ts";
import { isInteractive } from "./io.ts";

export interface Site {
  id: string;
  path: string;
  url: string;
  status: "active" | "expired";
  spa: boolean;
  expires_at: string | null;
  size_bytes: number;
  file_count: number;
  created_at: string;
  updated_at: string;
  last_deployed_at: string | null;
}

export interface RequestOptions {
  method?: string;
  /** A factory, not a body: a retry after re-auth needs a fresh stream. */
  body?: () => BodyInit;
  headers?: Record<string, string>;
}

const UNAUTHENTICATED_MESSAGE = "Run `drop login` in a terminal first.";

export class Api {
  readonly controlUrl: string;
  private token: string | undefined;
  private readonly interactive: boolean;

  constructor(controlUrl: string, options: { interactive?: boolean } = {}) {
    this.controlUrl = controlUrl;
    this.token = getToken(controlUrl);
    this.interactive = options.interactive ?? isInteractive();
  }

  hasToken(): boolean {
    return Boolean(this.token);
  }

  /** Obtain a token, logging in through the browser when that is possible. */
  async authenticate(force = false): Promise<void> {
    if (this.token && !force) return;
    if (process.env.DROP_TOKEN && !force) return;
    if (!this.interactive) {
      throw new CliError("unauthenticated", UNAUTHENTICATED_MESSAGE);
    }
    const credential = await deviceLogin(this.controlUrl);
    this.token = credential.token;
  }

  /** Authenticated request. Retries once through a fresh login on a 401. */
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    await this.authenticate();
    let response = await this.send(path, options);

    if (response.status === 401) {
      if (process.env.DROP_TOKEN || !this.interactive) {
        throw new CliError("unauthenticated", UNAUTHENTICATED_MESSAGE);
      }
      deleteCredential(this.controlUrl);
      this.token = undefined;
      await this.authenticate(true);
      response = await this.send(path, options);
    }

    if (!response.ok) throw await toError(response);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  private async send(path: string, options: RequestOptions): Promise<Response> {
    const headers: Record<string, string> = { accept: "application/json", ...options.headers };
    if (this.token) headers.authorization = `Bearer ${this.token}`;
    try {
      return await fetch(`${this.controlUrl}${path}`, {
        method: options.method ?? "GET",
        headers,
        body: options.body?.(),
      });
    } catch (error) {
      throw new CliError(
        "network_error",
        `Cannot reach Drop at ${this.controlUrl}: ${(error as Error).message}`,
      );
    }
  }
}

async function toError(response: Response): Promise<CliError> {
  let code = "http_error";
  let message = `Drop returned HTTP ${response.status}.`;
  try {
    const body = (await response.json()) as { error?: string; message?: string };
    if (body?.error) code = body.error;
    if (body?.message) message = body.message;
  } catch {
    /* non-JSON body: keep the generic message */
  }
  return new CliError(code, message);
}
