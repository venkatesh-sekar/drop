#!/bin/sh
# Installs the Drop CLI (`drop`) and its MCP server (`drop-mcp`).
#
#   curl -fsSL __DROP_URL__/install | sh
#
# Needs Node.js 20 or newer. Bundles go to ~/.drop/lib, wrappers to ~/.local/bin
# (override with DROP_BIN_DIR). Run it again to update. On Windows, use WSL.
set -eu

DROP_URL="__DROP_URL__"
LIB_DIR="${DROP_HOME:-$HOME/.drop}/lib"
BIN_DIR="${DROP_BIN_DIR:-$HOME/.local/bin}"

say() { printf '%s\n' "$*" >&2; }
die() { say "drop install: $*"; exit 1; }

# --- Node.js ---------------------------------------------------------------
NODE="$(command -v node 2>/dev/null || true)"
[ -n "$NODE" ] || die "Node.js 20 or newer is required, but 'node' is not on your PATH. Install it from https://nodejs.org and run this again."
major="$("$NODE" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
[ "$major" -ge 20 ] 2>/dev/null || die "Node.js 20 or newer is required (found $("$NODE" -v))."

# --- download ---------------------------------------------------------------
fetch() { # fetch <url> <dest>
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$1" -o "$2"
  elif command -v wget >/dev/null 2>&1; then
    wget -q "$1" -O "$2"
  else
    die "curl or wget is required."
  fi
}

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

say "Downloading from $DROP_URL ..."
fetch "$DROP_URL/install/drop.js" "$tmp/drop.js"
fetch "$DROP_URL/install/drop-mcp.js" "$tmp/drop-mcp.js"

mkdir -p "$LIB_DIR" "$BIN_DIR"
mv "$tmp/drop.js" "$LIB_DIR/drop.js"
mv "$tmp/drop-mcp.js" "$LIB_DIR/drop-mcp.js"

# --- wrappers ---------------------------------------------------------------
# The bundles are ES modules, which Node 20 will not run from an extensionless
# file, so each command is a two-line wrapper. It pins the Node found now and
# falls back to whatever `node` is on PATH later.
wrap() { # wrap <name>
  cat >"$BIN_DIR/$1" <<EOF
#!/bin/sh
node_bin="$NODE"
[ -x "\$node_bin" ] || node_bin=node
exec "\$node_bin" "$LIB_DIR/$1.js" "\$@"
EOF
  chmod +x "$BIN_DIR/$1"
}
wrap drop
wrap drop-mcp

# --- point the CLI at this Drop --------------------------------------------
"$NODE" - "$DROP_URL" <<'EOF'
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const xdg = (process.env.XDG_CONFIG_HOME || "").trim();
const dir = path.join(xdg || path.join(os.homedir(), ".config"), "drop");
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const file = path.join(dir, "config.json");
let current = {};
try { current = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
const next = { ...current, url: process.argv[2].replace(/\/+$/, "") };
fs.writeFileSync(file, JSON.stringify(next, null, 2) + "\n", { mode: 0o600 });
EOF

# --- done -------------------------------------------------------------------
version="$("$BIN_DIR/drop" --version 2>/dev/null || echo unknown)"
say ""
say "Installed drop $version and drop-mcp to $BIN_DIR, pointed at $DROP_URL."
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *)
    say ""
    say "$BIN_DIR is not on your PATH. Add it (then open a new terminal):"
    say "  export PATH=\"$BIN_DIR:\$PATH\""
    ;;
esac
say ""
say "Next: drop login"
