import { describe, expect, it } from "vitest";
import {
  isReservedPath,
  isValidPath,
  normalizePath,
  RESERVED_PATHS,
  suggestPathFromFolder,
  validatePath,
} from "./paths";

describe("normalizePath", () => {
  it("lowercases and hyphenates", () => {
    expect(normalizePath("Route Optimizer")).toBe("route-optimizer");
    expect(normalizePath("sales_dashboard")).toBe("sales-dashboard");
    expect(normalizePath("  My   Site  ")).toBe("my-site");
  });

  it("strips unsafe characters and collapses hyphens", () => {
    expect(normalizePath("Hello, World!")).toBe("hello-world");
    expect(normalizePath("a--__--b")).toBe("a-b");
    expect(normalizePath("--edges--")).toBe("edges");
    expect(normalizePath("café/site")).toBe("cafsite");
  });

  it("returns empty for input with nothing usable", () => {
    expect(normalizePath("!!!")).toBe("");
  });
});

describe("isValidPath", () => {
  it("accepts simple paths", () => {
    expect(isValidPath("a")).toBe(true);
    expect(isValidPath("route-optimizer")).toBe(true);
    expect(isValidPath("a1")).toBe(true);
  });

  it("rejects bad shapes", () => {
    expect(isValidPath("")).toBe(false);
    expect(isValidPath("-lead")).toBe(false);
    expect(isValidPath("trail-")).toBe(false);
    expect(isValidPath("Upper")).toBe(false);
    expect(isValidPath("a".repeat(65))).toBe(false);
  });
});

describe("reserved paths", () => {
  it("flags every reserved word", () => {
    for (const word of RESERVED_PATHS) expect(isReservedPath(word)).toBe(true);
  });

  it("does not flag ordinary paths", () => {
    expect(isReservedPath("route-optimizer")).toBe(false);
  });
});

describe("validatePath", () => {
  it("normalizes and accepts", () => {
    expect(validatePath("Route Optimizer")).toEqual({ ok: true, path: "route-optimizer" });
  });

  it("rejects invalid input", () => {
    const result = validatePath("!!!");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invalid_path");
  });

  it("rejects reserved words after normalization", () => {
    const result = validatePath("Admin");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("reserved_path");
  });
});

describe("suggestPathFromFolder", () => {
  it("uses the folder basename", () => {
    expect(suggestPathFromFolder("/home/me/Route Optimizer")).toBe("route-optimizer");
    expect(suggestPathFromFolder("./sales_dashboard")).toBe("sales-dashboard");
  });

  it("skips build output folder names in favour of the parent", () => {
    expect(suggestPathFromFolder("/home/me/route-optimizer/dist")).toBe("route-optimizer");
    expect(suggestPathFromFolder("/home/me/route-optimizer/build/")).toBe("route-optimizer");
    expect(suggestPathFromFolder("projects/my-app/out")).toBe("my-app");
    expect(suggestPathFromFolder("projects/my-app/public")).toBe("my-app");
    expect(suggestPathFromFolder("C:\\work\\My App\\dist")).toBe("my-app");
  });

  it("keeps the build folder name when there is no parent", () => {
    expect(suggestPathFromFolder("dist")).toBe("dist");
  });
});
