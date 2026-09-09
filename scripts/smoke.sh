#!/usr/bin/env bash
# End-to-end smoke test for a running Drop stack (mock auth provider).
#
#   docker compose up -d          # infra
#   pnpm dev                      # control :3100 and gateway :3101
#   ./scripts/smoke.sh
#
# Overrides: CONTROL_URL, SITES_URL.
set -uo pipefail

CONTROL_URL="${CONTROL_URL:-http://localhost:3100}"
SITES_URL="${SITES_URL:-http://localhost:3101}"
CONTROL_URL="${CONTROL_URL%/}"
SITES_URL="${SITES_URL%/}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_DIR="$(mktemp -d)"
STEP=0
SITE_PATH=""
TOKEN=""

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
dim()   { printf '\033[2m%s\033[0m\n' "$*"; }

fail() {
  red "FAIL: $*"
  if [ -n "$SITE_PATH" ] && [ -n "$TOKEN" ]; then
    dim "leaving site /$SITE_PATH behind; delete it with:"
    dim "  curl -X DELETE -H 'Authorization: Bearer \$TOKEN' $CONTROL_URL/api/sites/$SITE_PATH"
  fi
  exit 1
}

step() {
  STEP=$((STEP + 1))
  printf '\n\033[1m%2d. %s\033[0m\n' "$STEP" "$*"
}

ok() { green "    ok — $*"; }

need() {
  command -v "$1" >/dev/null 2>&1 || fail "'$1' is required but not installed."
}

# Runs curl, writes the body to $WORK_DIR/body and echoes the status code ("000" on a
# transport error, with the curl message left in the body file).
api() {
  local out
  : >"$WORK_DIR/body"
  out="$(curl -sS -o "$WORK_DIR/body" -w '%{http_code}' "$@" 2>"$WORK_DIR/curlerr")"
  if [ -z "$out" ] || [ "$out" = "000" ]; then
    cat "$WORK_DIR/curlerr" >"$WORK_DIR/body" 2>/dev/null
    out="000"
  fi
  printf '%s' "$out"
}

expect_status() {
  local got="$1" want="$2" what="$3"
  if [ "$got" != "$want" ]; then
    red "    response:"
    head -c 800 "$WORK_DIR/body" >&2 2>/dev/null || true
    echo >&2
    fail "$what: expected HTTP $want, got $got"
  fi
}

json() { jq -r "$1" <"$WORK_DIR/body"; }

# ---------------------------------------------------------------------------
step "check prerequisites"
need curl
need jq
need zip
[ -f "$REPO_ROOT/examples/hello/index.html" ] || fail "examples/hello/index.html not found"
ok "curl, jq, zip present"

step "control app is up ($CONTROL_URL/health)"
code="$(api "$CONTROL_URL/health")"
expect_status "$code" 200 "GET /health"
ok "control healthy"

step "gateway is up ($SITES_URL/health)"
code="$(api "$SITES_URL/health")"
expect_status "$code" 200 "GET gateway /health"
ok "gateway healthy"

step "mint a dev token"
code="$(api -X POST "$CONTROL_URL/api/dev/token" \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke@example.com","display_name":"Smoke Test"}')"
expect_status "$code" 200 "POST /api/dev/token"
TOKEN="$(json '.token')"
[ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] || fail "dev token endpoint returned no token"
case "$TOKEN" in
  drop_*) ;;
  *) fail "token does not look like a drop token: $TOKEN" ;;
esac
ok "token minted"

AUTH=(-H "Authorization: Bearer $TOKEN")

step "zip examples/hello"
ARCHIVE="$WORK_DIR/hello.zip"
( cd "$REPO_ROOT/examples/hello" && zip -qr "$ARCHIVE" . -x '.*' ) || fail "zip failed"
[ -s "$ARCHIVE" ] || fail "archive is empty"
ok "$(wc -c <"$ARCHIVE" | tr -d ' ') bytes"

SITE_PATH="smoke-$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c 8)"
step "deploy to /$SITE_PATH"
code="$(api -X POST "${AUTH[@]}" \
  -F "archive=@$ARCHIVE;type=application/zip" \
  -F "expiry=30d" \
  "$CONTROL_URL/api/sites/$SITE_PATH/deploy")"
expect_status "$code" 200 "POST /api/sites/$SITE_PATH/deploy"
SITE_URL="$(json '.url')"
[ "$(json '.path')" = "$SITE_PATH" ] || fail "deploy returned path $(json '.path'), wanted $SITE_PATH"
[ "$(json '.site.status')" = "active" ] || fail "deployed site is not active"
[ "$(json '.site.expires_at')" != "null" ] || fail "30d deploy has no expiry"
ok "live at $SITE_URL"

step "GET $SITES_URL/$SITE_PATH/ through the gateway"
code="$(api "$SITES_URL/$SITE_PATH/")"
expect_status "$code" 200 "GET /$SITE_PATH/"
grep -q "Hello from Drop" "$WORK_DIR/body" || fail "index.html body did not contain 'Hello from Drop'"
ctype="$(curl -sS -o /dev/null -w '%{content_type}' "$SITES_URL/$SITE_PATH/")"
case "$ctype" in
  text/html*) ;;
  *) fail "index.html content-type was '$ctype', wanted text/html" ;;
esac
ok "index.html served as $ctype"

step "GET $SITES_URL/$SITE_PATH/style.css"
code="$(api "$SITES_URL/$SITE_PATH/style.css")"
expect_status "$code" 200 "GET /$SITE_PATH/style.css"
grep -q "\-\-accent" "$WORK_DIR/body" || fail "style.css body did not look like the example stylesheet"
ctype="$(curl -sS -o /dev/null -w '%{content_type}' "$SITES_URL/$SITE_PATH/style.css")"
case "$ctype" in
  text/css*) ;;
  *) fail "style.css content-type was '$ctype', wanted text/css" ;;
esac
ok "style.css served as $ctype"

step "GET $SITES_URL/$SITE_PATH (no trailing slash) redirects"
code="$(curl -sS -o /dev/null -w '%{http_code}' "$SITES_URL/$SITE_PATH")"
[ "$code" = "301" ] || fail "expected 301 redirect to /$SITE_PATH/, got $code"
loc="$(curl -sS -o /dev/null -D - "$SITES_URL/$SITE_PATH" | tr -d '\r' | awk 'tolower($1)=="location:"{print $2}')"
case "$loc" in
  */"$SITE_PATH"/) ;;
  *) fail "redirect Location was '$loc', wanted /$SITE_PATH/" ;;
esac
ok "301 → $loc"

step "GET a missing file returns 404"
code="$(api "$SITES_URL/$SITE_PATH/definitely-not-here.txt")"
expect_status "$code" 404 "GET a missing asset"
ok "404 for unknown assets"

step "redeploy the same path with changed content"
REDEPLOY_DIR="$WORK_DIR/redeploy"
cp -r "$REPO_ROOT/examples/hello" "$REDEPLOY_DIR"
MARKER="redeployed-$(date +%s)"
printf '<!doctype html><html><head><meta charset="utf-8"><title>%s</title></head><body><h1>%s</h1></body></html>\n' \
  "$MARKER" "$MARKER" >"$REDEPLOY_DIR/index.html"
ARCHIVE2="$WORK_DIR/hello2.zip"
( cd "$REDEPLOY_DIR" && zip -qr "$ARCHIVE2" . -x '.*' ) || fail "zip failed"
code="$(api -X POST "${AUTH[@]}" -F "archive=@$ARCHIVE2;type=application/zip" \
  "$CONTROL_URL/api/sites/$SITE_PATH/deploy")"
expect_status "$code" 200 "redeploy"
[ "$(json '.site.expires_at')" != "null" ] || fail "redeploy without expiry should keep the existing expiry"
sleep 6 # gateway caches site lookups for ~5s
code="$(api "$SITES_URL/$SITE_PATH/")"
expect_status "$code" 200 "GET redeployed index"
grep -q "$MARKER" "$WORK_DIR/body" || fail "gateway still serves the previous deployment"
ok "new deployment is live"

step "GET /api/sites/$SITE_PATH/availability says it is yours"
code="$(api "${AUTH[@]}" "$CONTROL_URL/api/sites/$SITE_PATH/availability")"
expect_status "$code" 200 "GET availability"
[ "$(json '.availability')" = "yours" ] || fail "availability was $(json '.availability'), wanted yours"
FREE_PATH="free-$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c 8)"
code="$(api "${AUTH[@]}" "$CONTROL_URL/api/sites/$FREE_PATH/availability")"
expect_status "$code" 200 "GET availability of an unused path"
[ "$(json '.availability')" = "free" ] || fail "availability of $FREE_PATH was $(json '.availability'), wanted free"
ok "yours / free"

step "deploy a single html file (no index.html)"
SINGLE_DIR="$WORK_DIR/single"
mkdir -p "$SINGLE_DIR"
printf '<!doctype html><title>single</title><h1>Single file drop</h1>\n' >"$SINGLE_DIR/report.html"
SINGLE_ZIP="$WORK_DIR/single.zip"
( cd "$SINGLE_DIR" && zip -q "$SINGLE_ZIP" report.html ) || fail "zip failed"
SINGLE_PATH="$SITE_PATH-file"
code="$(api -X POST "${AUTH[@]}" -F "archive=@$SINGLE_ZIP;type=application/zip" \
  "$CONTROL_URL/api/sites/$SINGLE_PATH/deploy")"
expect_status "$code" 200 "deploy a lone report.html"
[ "$(json '.site.file_count')" = "1" ] || fail "single-file site has $(json '.site.file_count') files, wanted 1"
code="$(api "$SITES_URL/$SINGLE_PATH/")"
expect_status "$code" 200 "GET /$SINGLE_PATH/"
grep -q "Single file drop" "$WORK_DIR/body" || fail "/$SINGLE_PATH/ did not serve report.html as index.html"
code="$(api -X DELETE "${AUTH[@]}" "$CONTROL_URL/api/sites/$SINGLE_PATH")"
expect_status "$code" 204 "DELETE /api/sites/$SINGLE_PATH"
ok "report.html published as index.html"

step "a lone non-html file and an index-less folder are refused"
printf 'hello,world\n' >"$SINGLE_DIR/data.csv"
CSV_ZIP="$WORK_DIR/csv.zip"
( cd "$SINGLE_DIR" && zip -q "$CSV_ZIP" data.csv ) || fail "zip failed"
code="$(api -X POST "${AUTH[@]}" -F "archive=@$CSV_ZIP;type=application/zip" \
  "$CONTROL_URL/api/sites/$SINGLE_PATH/deploy")"
expect_status "$code" 400 "deploy a lone data.csv"
[ "$(json '.error')" = "missing_index" ] || fail "lone csv failed with $(json '.error'), wanted missing_index"
printf '<h1>chart</h1>' >"$SINGLE_DIR/chart.html"
BOTH_ZIP="$WORK_DIR/both.zip"
( cd "$SINGLE_DIR" && zip -q "$BOTH_ZIP" chart.html data.csv ) || fail "zip failed"
code="$(api -X POST "${AUTH[@]}" -F "archive=@$BOTH_ZIP;type=application/zip" \
  "$CONTROL_URL/api/sites/$SINGLE_PATH/deploy")"
expect_status "$code" 400 "deploy chart.html + data.csv without index.html"
[ "$(json '.error')" = "missing_index" ] || fail "index-less folder failed with $(json '.error'), wanted missing_index"
ok "both rejected with missing_index"

step "PATCH expiry to never"
code="$(api -X PATCH "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"expiry":"never"}' "$CONTROL_URL/api/sites/$SITE_PATH")"
expect_status "$code" 200 "PATCH /api/sites/$SITE_PATH"
[ "$(json '.site.expires_at')" = "null" ] || fail "expires_at is $(json '.site.expires_at'), wanted null"
ok "site is permanent"

step "GET /api/sites lists the site"
code="$(api "${AUTH[@]}" "$CONTROL_URL/api/sites")"
expect_status "$code" 200 "GET /api/sites"
found="$(jq -r --arg p "$SITE_PATH" '[.sites[] | select(.path == $p)] | length' <"$WORK_DIR/body")"
[ "$found" = "1" ] || fail "/api/sites did not list $SITE_PATH exactly once (got $found)"
ok "listed"

step "DELETE /api/sites/$SITE_PATH"
code="$(api -X DELETE "${AUTH[@]}" "$CONTROL_URL/api/sites/$SITE_PATH")"
expect_status "$code" 204 "DELETE /api/sites/$SITE_PATH"
ok "deleted"

step "gateway returns 404 for the deleted site"
sleep 6 # let the gateway's 5s lookup cache expire
code="$(api "$SITES_URL/$SITE_PATH/")"
expect_status "$code" 404 "GET a deleted site"
ok "404 after delete"

SITE_PATH=""
printf '\n'
green "All smoke checks passed."
