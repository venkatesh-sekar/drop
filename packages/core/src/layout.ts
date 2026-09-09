/**
 * How a set of uploaded file paths becomes a servable site. Pure and free of Node
 * imports so the web publisher can run the same rule before uploading.
 *
 * The rule is deliberately strict: a folder needs `index.html` at its root, or the
 * upload is a single html file, which is published as `index.html`. Nothing is guessed.
 */

const HTML_FILE = /\.html?$/i;

/**
 * The single wrapping folder to strip (`"site/"`), or `""` when there is none.
 * A wrapper is only stripped when `index.html` is not already at the root.
 */
export function wrapperPrefix(paths: string[]): string {
  if (paths.length === 0) return "";
  if (paths.includes("index.html")) return "";
  if (!paths.every((p) => p.includes("/"))) return "";
  const tops = new Set(paths.map((p) => p.slice(0, p.indexOf("/"))));
  if (tops.size !== 1) return "";
  return `${[...tops][0]!}/`;
}

/** True when `paths` is exactly one top-level html file. */
export function isSingleHtmlFile(paths: string[]): boolean {
  return paths.length === 1 && !paths[0]!.includes("/") && HTML_FILE.test(paths[0]!);
}

/**
 * The file (among already unwrapped `paths`) to serve at `/<path>/`: `index.html`
 * when present, the lone html file when that is all there is, otherwise null.
 */
export function homePage(paths: string[]): string | null {
  if (paths.includes("index.html")) return "index.html";
  if (isSingleHtmlFile(paths)) return paths[0]!;
  return null;
}
