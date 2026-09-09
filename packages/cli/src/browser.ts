import { spawn } from "node:child_process";

/** Best-effort browser open. Never throws: the caller always prints the URL too. */
export function openInBrowser(url: string): void {
  try {
    const [command, args] =
      process.platform === "darwin"
        ? ["open", [url]]
        : process.platform === "win32"
          ? ["cmd", ["/c", "start", "", url]]
          : ["xdg-open", [url]];
    const child = spawn(command as string, args as string[], {
      detached: true,
      stdio: "ignore",
    });
    child.on("error", () => {});
    child.unref();
  } catch {
    /* the printed URL is the fallback */
  }
}
