#!/bin/bash
# Black-box smoke test of the DEPLOYED worker's HTTP contract.
# Loads URL_KEVRED from .env (the proxy endpoint of a configured customer).
#
# Note: hits the live worker. The "malformed -> 400" check only passes once the
# current code (deterministic client-error passthrough) is deployed.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/.env" ]]; then
  set -a; . "$SCRIPT_DIR/.env"; set +a
fi
: "${URL_KEVRED:?set URL_KEVRED in .env}"

# derive an unconfigured customer: same domain, random first label
proto="${URL_KEVRED%%://*}"
host="${URL_KEVRED#*://}"; host="${host%%/*}"
BAD_URL="$proto://nope-$RANDOM.${host#*.}"

pass=0; fail=0
ok() { echo "  PASS  $1"; pass=$((pass+1)); }
ko() { echo "  FAIL  $1"; fail=$((fail+1)); }

# req URL PAYLOAD -> sets HTTP_CODE and BODY
req() {
  local tmp; tmp=$(mktemp)
  HTTP_CODE=$(curl -s -o "$tmp" -w '%{http_code}' -X POST \
    -H "Content-Type: application/json" -d "$2" --max-time 10 "$1")
  BODY=$(cat "$tmp"); rm -f "$tmp"
}

expect_code() { # NAME EXPECTED
  [[ "$HTTP_CODE" == "$2" ]] && ok "$1 ($HTTP_CODE)" || ko "$1 (expected $2, got $HTTP_CODE)"
}
expect_body() { # NAME SUBSTRING
  [[ "$BODY" == *"$2"* ]] && ok "$1" || ko "$1 (missing $2)"
}

echo "== smoke (deployed worker @ $URL_KEVRED) =="

# nominal: valid call passes through with a result
req "$URL_KEVRED" '{"jsonrpc":"2.0","id":1,"method":"getSlot"}'
expect_code "valid getSlot -> 200" 200
expect_body "valid getSlot -> body has result" '"result"'

# new passthrough: malformed bytes -> deterministic 400, NOT a masked 503
req "$URL_KEVRED" 'not json'
expect_code "malformed body -> 400 passthrough (not 503)" 400

# JSON-RPC app error rides on HTTP 200 -> passes through untouched
req "$URL_KEVRED" '{"jsonrpc":"2.0","id":1,"method":"thisMethodDoesNotExist"}'
expect_code "unknown method -> 200" 200
expect_body "unknown method -> body has error" '"error"'

# unconfigured customer -> 404 (config_error)
req "$BAD_URL" '{"jsonrpc":"2.0","id":1,"method":"getSlot"}'
expect_code "unknown customer -> 404" 404

echo
echo "$pass passed, $fail failed"
[[ $fail -eq 0 ]]
