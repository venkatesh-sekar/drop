import { afterEach, describe, expect, it } from "vitest";
import { resolveCliCommand } from "./cli.ts";

const savedEnv = { ...process.env };
afterEach(() => {
  process.env = { ...savedEnv };
});

describe("resolveCliCommand", () => {
  it("runs a DROP_CLI .js file under this node", () => {
    process.env.DROP_CLI = "/opt/drop/dist/drop.js";
    expect(resolveCliCommand()).toEqual({
      command: process.execPath,
      prefix: ["/opt/drop/dist/drop.js"],
    });
  });

  it("executes a DROP_CLI binary directly", () => {
    process.env.DROP_CLI = "/usr/local/bin/drop";
    expect(resolveCliCommand()).toEqual({ command: "/usr/local/bin/drop", prefix: [] });
  });

  it("falls back to the sibling workspace build when nothing is on PATH", () => {
    delete process.env.DROP_CLI;
    process.env.PATH = "";
    const resolved = resolveCliCommand();
    expect(resolved.command).toBe(process.execPath);
    expect(resolved.prefix[0]).toMatch(/cli[/\\]dist[/\\]drop\.js$/);
  });
});
