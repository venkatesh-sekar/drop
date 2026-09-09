import { describe, expect, it } from "vitest";
import { homePage, isSingleHtmlFile, wrapperPrefix } from "./layout";

describe("wrapperPrefix", () => {
  it("returns the single wrapping folder", () => {
    expect(wrapperPrefix(["site/index.html", "site/assets/app.js"])).toBe("site/");
  });

  it("returns empty when index.html is already at the root", () => {
    expect(wrapperPrefix(["index.html", "site/assets/app.js"])).toBe("");
  });

  it("returns empty for multiple top-level entries or a flat list", () => {
    expect(wrapperPrefix(["a/index.html", "b/app.js"])).toBe("");
    expect(wrapperPrefix(["index.html", "app.js"])).toBe("");
    expect(wrapperPrefix(["report.html"])).toBe("");
    expect(wrapperPrefix([])).toBe("");
  });
});

describe("isSingleHtmlFile", () => {
  it("is true only for exactly one top-level html file", () => {
    expect(isSingleHtmlFile(["report.html"])).toBe(true);
    expect(isSingleHtmlFile(["Report.HTM"])).toBe(true);
    expect(isSingleHtmlFile(["report.pdf"])).toBe(false);
    expect(isSingleHtmlFile(["docs/report.html"])).toBe(false);
    expect(isSingleHtmlFile(["report.html", "style.css"])).toBe(false);
    expect(isSingleHtmlFile([])).toBe(false);
  });
});

describe("homePage", () => {
  it("prefers index.html at the root", () => {
    expect(homePage(["index.html", "about.html", "assets/app.js"])).toBe("index.html");
  });

  it("accepts a lone html file", () => {
    expect(homePage(["report.html"])).toBe("report.html");
  });

  it("does not guess for anything else", () => {
    expect(homePage(["report.html", "assets/chart.js"])).toBeNull();
    expect(homePage(["a.html", "b.html"])).toBeNull();
    expect(homePage(["report.pdf"])).toBeNull();
    expect(homePage(["app.js", "style.css"])).toBeNull();
    expect(homePage([])).toBeNull();
  });
});
