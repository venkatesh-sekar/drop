import { describe, expect, it } from "vitest";
import { isValidPath, normalizePath, suggestPathFromFolder } from "./paths.ts";

describe("normalizePath", () => {
  it.each([
    ["Route Optimizer", "route-optimizer"],
    ["  Sales_Dashboard  ", "sales-dashboard"],
    ["My!!Site??", "mysite"],
    ["a--b---c", "a-b-c"],
    ["--edges--", "edges"],
    ["Store Analysis 2026", "store-analysis-2026"],
    ["ÜBER", "ber"],
    ["", ""],
  ])("normalizes %j to %j", (input, expected) => {
    expect(normalizePath(input)).toBe(expected);
  });
});

describe("isValidPath", () => {
  it("accepts normal paths", () => {
    expect(isValidPath("route-optimizer")).toBe(true);
    expect(isValidPath("a")).toBe(true);
  });

  it("rejects empty, edge-hyphenated, over-long and reserved paths", () => {
    expect(isValidPath("")).toBe(false);
    expect(isValidPath("-a")).toBe(false);
    expect(isValidPath("a-")).toBe(false);
    expect(isValidPath("a".repeat(65))).toBe(false);
    expect(isValidPath("admin")).toBe(false);
    expect(isValidPath("api")).toBe(false);
  });
});

describe("suggestPathFromFolder", () => {
  it("uses the folder name", () => {
    expect(suggestPathFromFolder("/tmp/Route Optimizer")).toBe("route-optimizer");
  });

  it("skips build-output folder names in favour of the parent", () => {
    expect(suggestPathFromFolder("/work/route-optimizer/dist")).toBe("route-optimizer");
    expect(suggestPathFromFolder("/work/Sales Dashboard/build")).toBe("sales-dashboard");
    expect(suggestPathFromFolder("/work/docs-site/out")).toBe("docs-site");
    expect(suggestPathFromFolder("/work/blog/_site")).toBe("blog");
  });

  it("handles trailing separators", () => {
    expect(suggestPathFromFolder("/work/my-app/dist/")).toBe("my-app");
  });
});
