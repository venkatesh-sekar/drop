/** The gateway's only two HTML pages. Same visual language as the control app, inline. */

const STYLE = `
:root{color-scheme:light dark;--bg:#f7f6f5;--fg:#171514;--muted:#6b6663;--accent:oklch(0.505 0.213 27.518)}
@media (prefers-color-scheme:dark){:root{--bg:#100f0e;--fg:#f3f1ef;--muted:#a09a96;--accent:oklch(0.66 0.19 24)}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:2rem;
background:var(--bg);color:var(--fg);
font:16px/1.6 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
-webkit-font-smoothing:antialiased}
main{width:min(30rem,100%);text-align:left}
h1{margin:0 0 .5rem;font-size:1.5rem;font-weight:600;letter-spacing:-0.02em}
p{margin:0 0 1.5rem;color:var(--muted)}
a.cta{display:inline-block;padding:.55rem 1.15rem;border-radius:999px;
background:var(--accent);color:#fff;text-decoration:none;font-weight:500}
a.cta:hover{opacity:.9}
.dot{width:.5rem;height:.5rem;border-radius:999px;background:var(--accent);margin-bottom:1.25rem}
`;

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>${STYLE}</style></head>
<body><main>${body}</main></body></html>
`;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function rootPage(controlUrl: string): string {
  return page(
    "Drop",
    `<div class="dot"></div>
<h1>Drop</h1>
<p>Sites published with Drop are served here.</p>
<a class="cta" href="${escapeAttr(controlUrl)}">Publish one</a>`,
  );
}

export function notFoundPage(controlUrl: string): string {
  return page(
    "Not found",
    `<div class="dot"></div>
<h1>This Drop isn&rsquo;t here.</h1>
<p>Nothing is published at this URL. It may have expired, been deleted, or never existed.</p>
<a class="cta" href="${escapeAttr(controlUrl)}">Publish one</a>`,
  );
}
