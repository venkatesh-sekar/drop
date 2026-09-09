import { parseArgs } from "./args.ts";
import { deploy } from "./commands/deploy.ts";
import { login, logout, whoami } from "./commands/session.ts";
import { list, open, remove } from "./commands/sites.ts";
import { resolveControlUrl } from "./config.ts";
import { CliError } from "./errors.ts";
import { HELP } from "./help.ts";
import { note, out } from "./io.ts";

declare const __DROP_VERSION__: string;
const VERSION = typeof __DROP_VERSION__ === "string" ? __DROP_VERSION__ : "0.0.0";

export async function main(argv: string[]): Promise<number> {
  let json = false;
  try {
    const args = parseArgs(argv);
    json = args.json;

    if (args.version) {
      out(VERSION);
      return 0;
    }
    if (args.help || args.command === undefined) {
      out(HELP.trimEnd());
      return args.command === undefined && !args.help ? 2 : 0;
    }

    const controlUrl = resolveControlUrl(args.url);

    switch (args.command) {
      case "deploy":
        await deploy(args, controlUrl);
        break;
      case "list":
        await list(args, controlUrl);
        break;
      case "delete":
        await remove(args, controlUrl);
        break;
      case "open":
        await open(args, controlUrl);
        break;
      case "login":
        await login(args, controlUrl);
        break;
      case "logout":
        logout(controlUrl);
        break;
      case "whoami":
        await whoami(args, controlUrl);
        break;
    }
    return 0;
  } catch (error) {
    if (error instanceof CliError) {
      if (json) out(JSON.stringify({ error: error.code, message: error.message }));
      else note(error.message);
      return error.exitCode;
    }
    const message = error instanceof Error ? error.message : String(error);
    if (json) out(JSON.stringify({ error: "unexpected_error", message }));
    else note(`drop: ${message}`);
    return 1;
  }
}
