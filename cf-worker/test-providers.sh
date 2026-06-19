#!/usr/bin/env bash
# Compare HTTP/RPC error behaviour between two Solana RPC providers.
# Usage: bash test-providers.sh [-v|--verbose]
#
# Requires: curl, jq
# Endpoints (with API keys) are loaded from .env — see .env.example.

for _tool in curl jq; do
  command -v "$_tool" >/dev/null 2>&1 || { echo "ERROR: $_tool not found"; exit 1; }
done

# ── Endpoints ─────────────────────────────────────────────────────────────────
# Loads URL_HELIUS and URL_TRITON from .env (see .env.example).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/.env" ]]; then
  set -a; . "$SCRIPT_DIR/.env"; set +a
fi
: "${URL_HELIUS:?set URL_HELIUS in .env}"
: "${URL_TRITON:?set URL_TRITON in .env}"

HELIUS="$URL_HELIUS"
TRITON="$URL_TRITON"

# Auth variants (for section 12), derived from the base URLs above.
# Helius keys via ?api-key=… ; Triton keys are the last URL path segment.
HELIUS_BADKEY="${HELIUS%%\?*}?api-key=00000000-0000-0000-0000-000000000000"
HELIUS_NOKEY="${HELIUS%%\?*}"
TRITON_BADKEY="${TRITON%/*}/00000000-0000-0000-0000-000000000000"
TRITON_NOKEY="${TRITON%/*}/"

# ── Options ───────────────────────────────────────────────────────────────────
VERBOSE=false
[[ "${1:-}" == "-v" || "${1:-}" == "--verbose" ]] && VERBOSE=true
TIMEOUT=15

# ── Colors ────────────────────────────────────────────────────────────────────
R='\033[0;31m'; G='\033[0;32m'; Y='\033[1;33m'
B='\033[0;34m'; C='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# ── Temp files ────────────────────────────────────────────────────────────────
H_TMP=$(mktemp); T_TMP=$(mktemp); H_HDR=$(mktemp); T_HDR=$(mktemp)
trap 'rm -f "$H_TMP" "$T_TMP" "$H_HDR" "$T_HDR"' EXIT

# ── Counters ──────────────────────────────────────────────────────────────────
TOTAL=0; SAME=0; DIFF_COUNT=0; DIFF_LIST=""

# ── Helpers ───────────────────────────────────────────────────────────────────
section() {
  printf "\n${B}${BOLD}━━━ %s ━━━${NC}\n" "$1"
}

# Summarise the RPC-level response for comparison and display.
# Returns: "rpc[CODE] message", "result=ok", or first 80 chars of raw body.
rpc_err() {
  local body="$1"
  [[ -z "$body" ]] && printf "(no body)" && return

  local code msg
  code=$(printf '%s' "$body" | jq -r '.error.code // empty' 2>/dev/null)
  if [[ -n "$code" ]]; then
    msg=$(printf '%s' "$body" | jq -r '.error.message // ""' 2>/dev/null | head -c 80)
    printf "rpc[%s] %s" "$code" "$msg"
  elif printf '%s' "$body" | jq -e 'has("result")' >/dev/null 2>&1; then
    printf "result=ok"
  else
    printf '%.80s' "$(printf '%s' "$body" | tr -d '\n')"
  fi
}

# Record a test result, print it, update counters.
print_cmp() {
  local name="$1" h_st="$2" h_body="$3" t_st="$4" t_body="$5"
  TOTAL=$((TOTAL + 1))

  local h_err t_err
  h_err=$(rpc_err "$h_body")
  t_err=$(rpc_err "$t_body")

  local is_same=true
  [[ "$h_st" != "$t_st" ]] && is_same=false
  [[ "$h_err" != "$t_err" ]] && is_same=false

  if $is_same; then
    SAME=$((SAME + 1))
    printf "${G}[SAME]${NC} ${BOLD}%-62s${NC}  HTTP %s\n" "$name" "$h_st"
    $VERBOSE && { printf "       H: %s\n" "$h_err"; printf "       T: %s\n" "$t_err"; }
  else
    DIFF_COUNT=$((DIFF_COUNT + 1))
    DIFF_LIST="${DIFF_LIST}\n  • ${name}"
    printf "${R}[DIFF]${NC} ${BOLD}%-62s${NC}  H:%s  T:%s\n" "$name" "$h_st" "$t_st"
    printf "       ${C}H${NC}: %s\n" "$h_err"
    printf "       ${Y}T${NC}: %s\n" "$t_err"
  fi
}

# POST application/json — used for most tests.
# pj NAME PAYLOAD [H_URL [T_URL]]
pj() {
  local name="$1" payload="$2" h_url="${3:-$HELIUS}" t_url="${4:-$TRITON}"
  local h_st t_st
  h_st=$(curl -s -o "$H_TMP" -w "%{http_code}" \
    -X POST -H "Content-Type: application/json" -d "$payload" \
    --max-time "$TIMEOUT" "$h_url" 2>/dev/null) || h_st="000"
  t_st=$(curl -s -o "$T_TMP" -w "%{http_code}" \
    -X POST -H "Content-Type: application/json" -d "$payload" \
    --max-time "$TIMEOUT" "$t_url" 2>/dev/null) || t_st="000"
  print_cmp "$name" "$h_st" "$(cat "$H_TMP")" "$t_st" "$(cat "$T_TMP")"
}

# POST with custom Content-Type — empty string means omit the header entirely.
pct() {
  local name="$1" payload="$2" ct="$3"
  local h_args=(-X POST -d "$payload" --max-time "$TIMEOUT")
  local t_args=(-X POST -d "$payload" --max-time "$TIMEOUT")
  if [[ -n "$ct" ]]; then
    h_args+=(-H "Content-Type: $ct")
    t_args+=(-H "Content-Type: $ct")
  fi
  local h_st t_st
  h_st=$(curl -s -o "$H_TMP" -w "%{http_code}" "${h_args[@]}" "$HELIUS" 2>/dev/null) || h_st="000"
  t_st=$(curl -s -o "$T_TMP" -w "%{http_code}" "${t_args[@]}" "$TRITON" 2>/dev/null) || t_st="000"
  print_cmp "$name" "$h_st" "$(cat "$H_TMP")" "$t_st" "$(cat "$T_TMP")"
}

# Different HTTP verb. Empty payload = no -d flag.
meth() {
  local name="$1" method="$2" payload="${3:-}"
  local h_args=(-X "$method" -H "Content-Type: application/json" --max-time "$TIMEOUT")
  local t_args=(-X "$method" -H "Content-Type: application/json" --max-time "$TIMEOUT")
  if [[ -n "$payload" ]]; then
    h_args+=(-d "$payload")
    t_args+=(-d "$payload")
  fi
  local h_st t_st
  h_st=$(curl -s -o "$H_TMP" -w "%{http_code}" "${h_args[@]}" "$HELIUS" 2>/dev/null) || h_st="000"
  t_st=$(curl -s -o "$T_TMP" -w "%{http_code}" "${t_args[@]}" "$TRITON" 2>/dev/null) || t_st="000"
  print_cmp "$name" "$h_st" "$(cat "$H_TMP")" "$t_st" "$(cat "$T_TMP")"
}

# Generate a string of N repetitions of char C (portable, no python3 needed).
repeat_char() {
  local char="$1" n="$2"
  printf '%*s' "$n" '' | tr ' ' "$char"
}

# ── Constants ─────────────────────────────────────────────────────────────────
VALID='{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
WSOL="So11111111111111111111111111111111111111112"   # wSOL mint (real account)
SYSPROG="11111111111111111111111111111111"            # System Program

printf "${BOLD}Helius vs Triton — RPC error behaviour comparison${NC}\n"
printf "Date : %s\n" "$(date)"
printf "Mode : %s\n" "$( $VERBOSE && echo verbose || echo normal)"

# ═════════════════════════════════════════════════════════════════════════════
section "1. Baseline — valid requests"
# ─────────────────────────────────────────────────────────────────────────────
pj "getHealth"                          "$VALID"
pj "getSlot"                            '{"jsonrpc":"2.0","id":1,"method":"getSlot"}'
pj "getVersion"                         '{"jsonrpc":"2.0","id":1,"method":"getVersion"}'
pj "getBalance — system program"        '{"jsonrpc":"2.0","id":1,"method":"getBalance","params":["'"$SYSPROG"'"]}'
pj "getAccountInfo — wSOL (base64)"     '{"jsonrpc":"2.0","id":1,"method":"getAccountInfo","params":["'"$WSOL"'",{"encoding":"base64"}]}'
pj "getRecentBlockhash"                 '{"jsonrpc":"2.0","id":1,"method":"getLatestBlockhash"}'

# ═════════════════════════════════════════════════════════════════════════════
section "2. Malformed request body"
# ─────────────────────────────────────────────────────────────────────────────
pj "Empty body"                         ""
pj "Plain text (not JSON)"              "hello world"
pj "JSON array at root"                 "[]"
pj "JSON number at root"                "42"
pj "JSON boolean at root"               "true"
pj "JSON null at root"                  "null"
pj "Truncated JSON (mid-key)"           '{"jsonrpc":"2.0","met'
pj "Truncated JSON (mid-value)"         '{"jsonrpc":"2.0","method":"getHea'
pj "Duplicate keys"                     '{"jsonrpc":"2.0","id":1,"method":"getHealth","method":"getSlot"}'
pj "Comments in JSON (invalid)"         '{"jsonrpc":"2.0","id":1,/*comment*/"method":"getHealth"}'

# ═════════════════════════════════════════════════════════════════════════════
section "3. Invalid JSON-RPC envelope (valid JSON, wrong structure)"
# ─────────────────────────────────────────────────────────────────────────────
pj "Missing jsonrpc field"              '{"id":1,"method":"getHealth"}'
pj "jsonrpc = \"1.0\""                  '{"jsonrpc":"1.0","id":1,"method":"getHealth"}'
pj "jsonrpc = \"3.0\""                  '{"jsonrpc":"3.0","id":1,"method":"getHealth"}'
pj "jsonrpc = \"2.0 \" (trailing space)" '{"jsonrpc":"2.0 ","id":1,"method":"getHealth"}'
pj "jsonrpc is integer 2"               '{"jsonrpc":2,"id":1,"method":"getHealth"}'
pj "jsonrpc is null"                    '{"jsonrpc":null,"id":1,"method":"getHealth"}'
pj "Missing method field"               '{"jsonrpc":"2.0","id":1}'
pj "method is null"                     '{"jsonrpc":"2.0","id":1,"method":null}'
pj "method is integer 42"               '{"jsonrpc":"2.0","id":1,"method":42}'
pj "method is boolean true"             '{"jsonrpc":"2.0","id":1,"method":true}'
pj "method is array"                    '{"jsonrpc":"2.0","id":1,"method":["getHealth"]}'
pj "method is object"                   '{"jsonrpc":"2.0","id":1,"method":{"name":"getHealth"}}'
pj "Notification — no id (valid spec)"  '{"jsonrpc":"2.0","method":"getHealth"}'
pj "id is null"                         '{"jsonrpc":"2.0","id":null,"method":"getHealth"}'
pj "id is array"                        '{"jsonrpc":"2.0","id":[1,2],"method":"getHealth"}'
pj "id is object"                       '{"jsonrpc":"2.0","id":{},"method":"getHealth"}'
pj "id is boolean"                      '{"jsonrpc":"2.0","id":true,"method":"getHealth"}'
pj "params is a string"                 '{"jsonrpc":"2.0","id":1,"method":"getSlot","params":"wrong"}'
pj "params is a number"                 '{"jsonrpc":"2.0","id":1,"method":"getSlot","params":42}'
pj "Extra top-level unknown fields"     '{"jsonrpc":"2.0","id":1,"method":"getHealth","foo":"bar","baz":123}'

# ═════════════════════════════════════════════════════════════════════════════
section "4. Unknown / invalid method names"
# ─────────────────────────────────────────────────────────────────────────────
pj "Completely unknown method"          '{"jsonrpc":"2.0","id":1,"method":"unknownMethod"}'
pj "Empty method string"                '{"jsonrpc":"2.0","id":1,"method":""}'
pj "Method name with typo"             '{"jsonrpc":"2.0","id":1,"method":"getAccoontInfo"}'
pj "Method with spaces"                 '{"jsonrpc":"2.0","id":1,"method":"get Health"}'
pj "Method with leading slash"          '{"jsonrpc":"2.0","id":1,"method":"/getHealth"}'
pj "Method with path traversal"         '{"jsonrpc":"2.0","id":1,"method":"../etc/passwd"}'
pj "SQL injection in method"            '{"jsonrpc":"2.0","id":1,"method":"getHealth;DROP TABLE--"}'
pj "Admin-like method"                  '{"jsonrpc":"2.0","id":1,"method":"stopNode"}'
pj "Private method (underscore prefix)" '{"jsonrpc":"2.0","id":1,"method":"_internalMethod"}'
pj "Solana debug method"                '{"jsonrpc":"2.0","id":1,"method":"simulateTransaction"}'

# ═════════════════════════════════════════════════════════════════════════════
section "5. Valid method — wrong param shape"
# ─────────────────────────────────────────────────────────────────────────────
pj "getBalance — no params key"         '{"jsonrpc":"2.0","id":1,"method":"getBalance"}'
pj "getBalance — empty array"           '{"jsonrpc":"2.0","id":1,"method":"getBalance","params":[]}'
pj "getBalance — extra param"           '{"jsonrpc":"2.0","id":1,"method":"getBalance","params":["'"$WSOL"'","extra","more"]}'
pj "getBalance — params as object"      '{"jsonrpc":"2.0","id":1,"method":"getBalance","params":{"address":"'"$WSOL"'"}}'
pj "getBalance — integer instead of addr" '{"jsonrpc":"2.0","id":1,"method":"getBalance","params":[12345]}'
pj "getBalance — null address"          '{"jsonrpc":"2.0","id":1,"method":"getBalance","params":[null]}'
pj "getBalance — array instead of addr" '{"jsonrpc":"2.0","id":1,"method":"getBalance","params":[["'"$WSOL"'"]]}'
pj "getSlot — unexpected param"         '{"jsonrpc":"2.0","id":1,"method":"getSlot","params":["unexpected"]}'

# ═════════════════════════════════════════════════════════════════════════════
section "6. Invalid pubkeys / addresses"
# ─────────────────────────────────────────────────────────────────────────────
pj "Pubkey too short (5 chars)"         '{"jsonrpc":"2.0","id":1,"method":"getAccountInfo","params":["abc12"]}'
pj "Pubkey too long (50 chars)"         '{"jsonrpc":"2.0","id":1,"method":"getAccountInfo","params":["AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"]}'
pj "Non-base58 chars (0 O I l)"         '{"jsonrpc":"2.0","id":1,"method":"getAccountInfo","params":["0OIlAAAAAAAAAAAAAAAAAAAAAAAAAAAA"]}'
pj "Empty string pubkey"                '{"jsonrpc":"2.0","id":1,"method":"getAccountInfo","params":[""]}'
pj "Pubkey with spaces inside"          '{"jsonrpc":"2.0","id":1,"method":"getAccountInfo","params":["So111 111111111111111111111111111112"]}'
pj "Pubkey is all zeros (not base58)"   '{"jsonrpc":"2.0","id":1,"method":"getAccountInfo","params":["00000000000000000000000000000000"]}'
pj "Valid but nonexistent account"      '{"jsonrpc":"2.0","id":1,"method":"getAccountInfo","params":["BPFLoader1111111111111111111111111111111111"]}'
pj "Ethereum-style address (0x...)"     '{"jsonrpc":"2.0","id":1,"method":"getAccountInfo","params":["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"]}'

# ═════════════════════════════════════════════════════════════════════════════
section "7. Commitment level edge cases"
# ─────────────────────────────────────────────────────────────────────────────
for _c in processed confirmed finalized; do
  pj "getSlot commitment=$_c" '{"jsonrpc":"2.0","id":1,"method":"getSlot","params":[{"commitment":"'"$_c"'"}]}'
done
pj "commitment = imaginary"             '{"jsonrpc":"2.0","id":1,"method":"getSlot","params":[{"commitment":"imaginary"}]}'
pj "commitment = null"                  '{"jsonrpc":"2.0","id":1,"method":"getSlot","params":[{"commitment":null}]}'
pj "commitment = integer 2"             '{"jsonrpc":"2.0","id":1,"method":"getSlot","params":[{"commitment":2}]}'
unset _c

# ═════════════════════════════════════════════════════════════════════════════
section "8. Slot / block boundary cases"
# ─────────────────────────────────────────────────────────────────────────────
pj "getBlock — slot 0"                  '{"jsonrpc":"2.0","id":1,"method":"getBlock","params":[0]}'
pj "getBlock — slot 1"                  '{"jsonrpc":"2.0","id":1,"method":"getBlock","params":[1]}'
pj "getBlock — old slot (likely pruned)" '{"jsonrpc":"2.0","id":1,"method":"getBlock","params":[1000000]}'
pj "getBlock — slot is string"          '{"jsonrpc":"2.0","id":1,"method":"getBlock","params":["12345"]}'
pj "getBlock — slot is -1 (negative)"   '{"jsonrpc":"2.0","id":1,"method":"getBlock","params":[-1]}'
pj "getBlock — slot is float"           '{"jsonrpc":"2.0","id":1,"method":"getBlock","params":[12345.67]}'
pj "getBlock — future slot (max u64)"   '{"jsonrpc":"2.0","id":1,"method":"getBlock","params":[18446744073709551615]}'
pj "getBlock — null slot"               '{"jsonrpc":"2.0","id":1,"method":"getBlock","params":[null]}'
pj "getBlockHeight"                     '{"jsonrpc":"2.0","id":1,"method":"getBlockHeight"}'
pj "getEpochInfo"                       '{"jsonrpc":"2.0","id":1,"method":"getEpochInfo"}'

# ═════════════════════════════════════════════════════════════════════════════
section "9. Transaction edge cases"
# ─────────────────────────────────────────────────────────────────────────────
FAKE_SIG="5KtPn7hBQsBVGgRPV8Hm7dU8J6s4F6Xa1BVbkBjiFBcz7wLCi5rqLVxuLnFGkSN5cYF9iBnMrj8TKbkGrNyPU3M"
pj "getTransaction — fake sig (valid len)" '{"jsonrpc":"2.0","id":1,"method":"getTransaction","params":["'"$FAKE_SIG"'"]}'
pj "getTransaction — short sig"         '{"jsonrpc":"2.0","id":1,"method":"getTransaction","params":["abc123"]}'
pj "getTransaction — empty sig"         '{"jsonrpc":"2.0","id":1,"method":"getTransaction","params":[""]}'
pj "getTransaction — null sig"          '{"jsonrpc":"2.0","id":1,"method":"getTransaction","params":[null]}'
pj "getTransaction — with maxSupportedVersion" '{"jsonrpc":"2.0","id":1,"method":"getTransaction","params":["'"$FAKE_SIG"'",{"maxSupportedTransactionVersion":0}]}'
pj "sendTransaction — empty tx"         '{"jsonrpc":"2.0","id":1,"method":"sendTransaction","params":[""]}'
pj "sendTransaction — invalid base64"   '{"jsonrpc":"2.0","id":1,"method":"sendTransaction","params":["not_valid_base64!!"]}'
pj "sendTransaction — random base64"    '{"jsonrpc":"2.0","id":1,"method":"sendTransaction","params":["dGhpcyBpcyBub3QgYSB0cmFuc2FjdGlvbg=="]}'

# ═════════════════════════════════════════════════════════════════════════════
section "10. HTTP verb variations"
# ─────────────────────────────────────────────────────────────────────────────
meth "GET with JSON body"               "GET"     "$VALID"
meth "GET without body"                 "GET"     ""
meth "PUT"                              "PUT"     "$VALID"
meth "DELETE"                           "DELETE"  "$VALID"
meth "PATCH"                            "PATCH"   "$VALID"
meth "OPTIONS (CORS preflight)"         "OPTIONS" ""
meth "HEAD"                             "HEAD"    ""
meth "TRACE"                            "TRACE"   ""

# ═════════════════════════════════════════════════════════════════════════════
section "11. Content-Type header variations"
# ─────────────────────────────────────────────────────────────────────────────
pct "No Content-Type header"                        "$VALID" ""
pct "text/plain"                                    "$VALID" "text/plain"
pct "application/x-www-form-urlencoded"             "$VALID" "application/x-www-form-urlencoded"
pct "text/html"                                     "$VALID" "text/html"
pct "application/xml"                               "$VALID" "application/xml"
pct "application/octet-stream"                      "$VALID" "application/octet-stream"
pct "application/json; charset=utf-8"               "$VALID" "application/json; charset=utf-8"
pct "APPLICATION/JSON (uppercase)"                  "$VALID" "APPLICATION/JSON"

# ═════════════════════════════════════════════════════════════════════════════
section "12. Authentication / API key"
# ─────────────────────────────────────────────────────────────────────────────
pj "Wrong API key"                      "$VALID" "$HELIUS_BADKEY" "$TRITON_BADKEY"
pj "No API key in URL"                  "$VALID" "$HELIUS_NOKEY"  "$TRITON_NOKEY"

# ═════════════════════════════════════════════════════════════════════════════
section "13. Batch requests"
# ─────────────────────────────────────────────────────────────────────────────
pj "Empty batch []"                     "[]"
pj "Single-item valid batch"            "[${VALID}]"
pj "Two valid requests"                 '[{"jsonrpc":"2.0","id":1,"method":"getHealth"},{"jsonrpc":"2.0","id":2,"method":"getSlot"}]'
pj "Mixed: valid + unknown method"      '[{"jsonrpc":"2.0","id":1,"method":"getHealth"},{"jsonrpc":"2.0","id":2,"method":"unknownMethod"}]'
pj "Mixed: valid + malformed envelope"  '[{"jsonrpc":"2.0","id":1,"method":"getHealth"},{"id":2}]'
pj "All invalid in batch"               '[{"jsonrpc":"2.0","id":1,"method":"unknownMethod"},{"id":2,"method":"getSlot"}]'
pj "Duplicate IDs in batch"             '[{"jsonrpc":"2.0","id":1,"method":"getHealth"},{"jsonrpc":"2.0","id":1,"method":"getSlot"}]'
pj "Notification inside batch"          '[{"jsonrpc":"2.0","method":"getHealth"},{"jsonrpc":"2.0","id":1,"method":"getSlot"}]'
pj "Batch containing batch"             '[[{"jsonrpc":"2.0","id":1,"method":"getHealth"}]]'

# Large batch — 50 identical getHealth
_batch="["
for _i in $(seq 1 50); do
  [[ "$_i" -gt 1 ]] && _batch+=","
  _batch+="{\"jsonrpc\":\"2.0\",\"id\":$_i,\"method\":\"getHealth\"}"
done
_batch+="]"
pj "Large batch (50 items)"             "$_batch"
unset _batch _i

# ═════════════════════════════════════════════════════════════════════════════
section "14. Oversized / extreme payloads"
# ─────────────────────────────────────────────────────────────────────────────

# 100 KB method name
_big=$(repeat_char 'A' 100000)
pj "Method name 100 KB"                 "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"${_big}\"}"
unset _big

# 50 KB param string
_big=$(repeat_char 'B' 50000)
pj "Params string 50 KB"                "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getAccountInfo\",\"params\":[\"${_big}\"]}"
unset _big

# 1 KB id string
_big=$(repeat_char 'x' 1000)
pj "id = 1000-char string"              "{\"jsonrpc\":\"2.0\",\"id\":\"${_big}\",\"method\":\"getHealth\"}"
unset _big

pj "Deeply nested JSON (20 levels)"    '{"jsonrpc":"2.0","id":1,"method":"getHealth","params":[{"a":{"b":{"c":{"d":{"e":{"f":{"g":{"h":{"i":{"j":{"k":{"l":{"m":{"n":{"o":{"p":{"q":{"r":{"s":{"t":"deep"}}}}}}}}}}}}}}}}}}}}]}'

# ═════════════════════════════════════════════════════════════════════════════
section "15. Encoding edge cases"
# ─────────────────────────────────────────────────────────────────────────────
pj "Unicode in method name"             '{"jsonrpc":"2.0","id":1,"method":"getMéthode"}'
pj "Emoji in method name"               '{"jsonrpc":"2.0","id":1,"method":"getHealth🔥"}'
pj "CJK in method name"                 '{"jsonrpc":"2.0","id":1,"method":"获取健康"}'
pj "id is negative integer"             '{"jsonrpc":"2.0","id":-1,"method":"getHealth"}'
pj "id is float"                        '{"jsonrpc":"2.0","id":1.5,"method":"getHealth"}'
pj "id is very large number"            '{"jsonrpc":"2.0","id":99999999999999999999,"method":"getHealth"}'
pj "id is string"                       '{"jsonrpc":"2.0","id":"my-request-id","method":"getHealth"}'
pj "id = 0"                             '{"jsonrpc":"2.0","id":0,"method":"getHealth"}'
pj "Escaped unicode in method"          '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'

# ═════════════════════════════════════════════════════════════════════════════
section "16. Response headers inspection (valid request)"
# ─────────────────────────────────────────────────────────────────────────────
printf "  Fetching response headers from both providers...\n\n"

curl -s -o /dev/null -D "$H_HDR" \
  -X POST -H "Content-Type: application/json" -d "$VALID" \
  --max-time "$TIMEOUT" "$HELIUS" 2>/dev/null || true

curl -s -o /dev/null -D "$T_HDR" \
  -X POST -H "Content-Type: application/json" -d "$VALID" \
  --max-time "$TIMEOUT" "$TRITON" 2>/dev/null || true

printf "  ${C}Helius response headers:${NC}\n"
grep -iE '^(HTTP|content-type|x-ratelimit|retry-after|access-control|cf-|server|via|x-request|x-cache)' \
  "$H_HDR" | sed 's/^/    /' || printf "    (none matched)\n"

printf "\n  ${Y}Triton response headers:${NC}\n"
grep -iE '^(HTTP|content-type|x-ratelimit|retry-after|access-control|cf-|server|via|x-request|x-cache)' \
  "$T_HDR" | sed 's/^/    /' || printf "    (none matched)\n"

# ═════════════════════════════════════════════════════════════════════════════
section "17. Rate limiting — burst test (40 sequential requests)"
# ─────────────────────────────────────────────────────────────────────────────
BURST_N=40
printf "  Sending %d rapid sequential getHealth to each provider...\n" "$BURST_N"

_h_200=0; _h_429=0; _h_5xx=0; _h_other=0
for _i in $(seq 1 "$BURST_N"); do
  _st=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST -H "Content-Type: application/json" -d "$VALID" \
    --max-time 5 "$HELIUS" 2>/dev/null) || _st="000"
  case "$_st" in
    200)         _h_200=$((_h_200 + 1)) ;;
    429)         _h_429=$((_h_429 + 1)) ;;
    5[0-9][0-9]) _h_5xx=$((_h_5xx + 1)) ;;
    *)           _h_other=$((_h_other + 1)) ;;
  esac
done

_t_200=0; _t_429=0; _t_5xx=0; _t_other=0
for _i in $(seq 1 "$BURST_N"); do
  _st=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST -H "Content-Type: application/json" -d "$VALID" \
    --max-time 5 "$TRITON" 2>/dev/null) || _st="000"
  case "$_st" in
    200)         _t_200=$((_t_200 + 1)) ;;
    429)         _t_429=$((_t_429 + 1)) ;;
    5[0-9][0-9]) _t_5xx=$((_t_5xx + 1)) ;;
    *)           _t_other=$((_t_other + 1)) ;;
  esac
done

TOTAL=$((TOTAL + 1))
printf "\n  ${C}Helius${NC}: %d×200  %d×429  %d×5xx  %d×other\n" \
  "$_h_200" "$_h_429" "$_h_5xx" "$_h_other"
printf "  ${Y}Triton${NC}: %d×200  %d×429  %d×5xx  %d×other\n" \
  "$_t_200" "$_t_429" "$_t_5xx" "$_t_other"

_h_sig="${_h_429}_${_h_5xx}_${_h_other}"
_t_sig="${_t_429}_${_t_5xx}_${_t_other}"
if [[ "$_h_sig" == "$_t_sig" ]]; then
  SAME=$((SAME + 1))
  printf "  ${G}[SAME]${NC} Rate-limit behaviour matches\n"
else
  DIFF_COUNT=$((DIFF_COUNT + 1))
  DIFF_LIST="${DIFF_LIST}\n  • Burst rate-limiting (${BURST_N} requests)"
  printf "  ${R}[DIFF]${NC} Rate-limit behaviour differs\n"
fi
unset _h_200 _h_429 _h_5xx _h_other _t_200 _t_429 _t_5xx _t_other _i _st _h_sig _t_sig

# ═════════════════════════════════════════════════════════════════════════════
printf "\n${BOLD}════════════════════════════════════════${NC}\n"
printf "${BOLD}SUMMARY${NC}\n"
printf "${BOLD}════════════════════════════════════════${NC}\n"
printf "  Total : %d\n" "$TOTAL"
printf "  ${G}SAME${NC}  : %d\n" "$SAME"
printf "  ${R}DIFF${NC}  : %d\n" "$DIFF_COUNT"

if [[ -n "$DIFF_LIST" ]]; then
  printf "\n${R}Tests that differ:${NC}"
  printf "%b\n" "$DIFF_LIST"
fi
printf "\n"
