/** stdout is the machine channel: results only. */
export function out(line = ""): void {
  process.stdout.write(line + "\n");
}

/** stderr is the human channel: progress, prompts, diagnostics. */
export function note(line = ""): void {
  process.stderr.write(line + "\n");
}

export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/** Ask a question on stderr and read one line from stdin. Returns "" on EOF. */
export async function prompt(question: string): Promise<string> {
  const { createInterface } = await import("node:readline");
  return await new Promise<string>((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
    rl.on("close", () => resolve(""));
  });
}

export async function confirm(question: string): Promise<boolean> {
  const answer = (await prompt(`${question} `)).toLowerCase();
  return answer === "y" || answer === "yes";
}
