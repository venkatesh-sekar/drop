/** An expected, user-facing failure. Printed as one line, never as a stack trace. */
export class CliError extends Error {
  readonly code: string;
  readonly exitCode: number;

  constructor(code: string, message: string, exitCode = 1) {
    super(message);
    this.name = "CliError";
    this.code = code;
    this.exitCode = exitCode;
  }
}

/** Bad invocation: wrong flags, missing arguments. Exit code 2. */
export class UsageError extends CliError {
  constructor(message: string) {
    super("usage", message, 2);
    this.name = "UsageError";
  }
}
