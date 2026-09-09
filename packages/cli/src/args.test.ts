import { describe, expect, it } from "vitest";
import { parseArgs } from "./args.ts";
import { UsageError } from "./errors.ts";

describe("parseArgs", () => {
  it("parses a deploy invocation", () => {
    const args = parseArgs(["deploy", "./dist", "--path", "route-optimizer", "--permanent", "--json"]);
    expect(args.command).toBe("deploy");
    expect(args.positionals).toEqual(["./dist"]);
    expect(args.path).toBe("route-optimizer");
    expect(args.permanent).toBe(true);
    expect(args.json).toBe(true);
    expect(args.spa).toBe(false);
  });

  it("accepts --flag=value", () => {
    const args = parseArgs(["deploy", "./dist", "--path=my-site", "--url=https://drop.internal"]);
    expect(args.path).toBe("my-site");
    expect(args.url).toBe("https://drop.internal");
  });

  it("accepts short flags", () => {
    const args = parseArgs(["delete", "old-site", "-y"]);
    expect(args.command).toBe("delete");
    expect(args.yes).toBe(true);
    expect(args.positionals).toEqual(["old-site"]);
  });

  it("handles bare help and version", () => {
    expect(parseArgs(["--help"]).help).toBe(true);
    expect(parseArgs(["-h"]).help).toBe(true);
    expect(parseArgs(["--version"]).version).toBe(true);
    expect(parseArgs([]).command).toBeUndefined();
  });

  it("parses --expires as a whole number of days from 1 to 365", () => {
    expect(parseArgs(["deploy", "./dist", "--expires", "60"]).expires).toBe(60);
    expect(parseArgs(["deploy", "./dist", "--expires=365"]).expires).toBe(365);
    expect(parseArgs(["deploy", "./dist"]).expires).toBeUndefined();
    for (const bad of ["0", "366", "7.5", "07", "-7", "7d", "soon", ""]) {
      expect(() => parseArgs(["deploy", "./dist", "--expires", bad])).toThrow(UsageError);
    }
    expect(() => parseArgs(["deploy", "./dist", "--expires"])).toThrow(UsageError);
  });

  it("refuses --expires together with --permanent", () => {
    expect(() => parseArgs(["deploy", "./dist", "--expires", "7", "--permanent"])).toThrow(UsageError);
    expect(() => parseArgs(["deploy", "./dist", "--permanent", "--expires=7"])).toThrow(UsageError);
  });

  it("rejects unknown commands and options", () => {
    expect(() => parseArgs(["publish"])).toThrow(UsageError);
    expect(() => parseArgs(["list", "--nope"])).toThrow(UsageError);
    expect(() => parseArgs(["deploy", "./dist", "--path"])).toThrow(UsageError);
    expect(() => parseArgs(["list", "--json=1"])).toThrow(UsageError);
  });
});
