import { UsageError } from "./errors.ts";

export const COMMANDS = ["deploy", "login", "logout", "whoami", "list", "delete", "open"] as const;
export type Command = (typeof COMMANDS)[number];

export interface ParsedArgs {
  command?: Command;
  positionals: string[];
  url?: string;
  path?: string;
  json: boolean;
  yes: boolean;
  permanent: boolean;
  spa: boolean;
  help: boolean;
  version: boolean;
}

const VALUE_FLAGS = new Set(["--url", "--path"]);

function isCommand(value: string): value is Command {
  return (COMMANDS as readonly string[]).includes(value);
}

export function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {
    positionals: [],
    json: false,
    yes: false,
    permanent: false,
    spa: false,
    help: false,
    version: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;

    if (arg === "--") {
      result.positionals.push(...argv.slice(i + 1));
      break;
    }

    if (arg.startsWith("-") && arg !== "-") {
      // Split --flag=value once so both spellings reach the same code below.
      let name = arg;
      let inlineValue: string | undefined;
      const eq = arg.indexOf("=");
      if (arg.startsWith("--") && eq !== -1) {
        name = arg.slice(0, eq);
        inlineValue = arg.slice(eq + 1);
      }

      if (VALUE_FLAGS.has(name)) {
        const value = inlineValue ?? argv[++i];
        if (value === undefined) throw new UsageError(`${name} requires a value.`);
        if (name === "--url") result.url = value;
        else result.path = value;
        continue;
      }

      if (inlineValue !== undefined) throw new UsageError(`${name} does not take a value.`);

      switch (name) {
        case "--json":
          result.json = true;
          break;
        case "--yes":
        case "-y":
          result.yes = true;
          break;
        case "--permanent":
          result.permanent = true;
          break;
        case "--spa":
          result.spa = true;
          break;
        case "--help":
        case "-h":
          result.help = true;
          break;
        case "--version":
        case "-V":
          result.version = true;
          break;
        default:
          throw new UsageError(`Unknown option: ${name}`);
      }
      continue;
    }

    if (result.command === undefined && result.positionals.length === 0) {
      if (isCommand(arg)) {
        result.command = arg;
        continue;
      }
      throw new UsageError(`Unknown command: ${arg}`);
    }

    result.positionals.push(arg);
  }

  return result;
}
