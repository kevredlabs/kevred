#!/bin/bash
# Sequential latency benchmark for the deployed worker, per RPC method.
# Loads URL_KEVRED and URL_HELIUS from .env (see .env.example).
#
# Knobs (env):
#   REQUESTS   requests per method per target   (default 200)
#   SLEEP      pause between requests, seconds   (default 0)
#
#   REQUESTS=500 ./bench.sh
#   REQUESTS=100 SLEEP=0.2 ./bench.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/.env" ]]; then
  set -a; . "$SCRIPT_DIR/.env"; set +a
fi
: "${URL_KEVRED:?set URL_KEVRED in .env}"
: "${URL_HELIUS:?set URL_HELIUS in .env}"

REQUESTS="${REQUESTS:-200}"
SLEEP="${SLEEP:-0}"

METHODS=(
  'getSlot|{"jsonrpc":"2.0","id":1,"method":"getSlot"}'
  'getLatestBlockhash|{"jsonrpc":"2.0","id":1,"method":"getLatestBlockhash"}'
  'getBalance|{"jsonrpc":"2.0","id":1,"method":"getBalance","params":["11111111111111111111111111111111"]}'
  'getAccountInfo|{"jsonrpc":"2.0","id":1,"method":"getAccountInfo","params":["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",{"encoding":"base64"}]}'
  'getEpochInfo|{"jsonrpc":"2.0","id":1,"method":"getEpochInfo"}'
)

# fires REQUESTS curls one after another; each line is "<http_code> <time_total>"
bench() {
  local label="$1" url="$2" payload="$3"
  local tmp; tmp=$(mktemp)
  for i in $(seq 1 "$REQUESTS"); do
    curl -s -o /dev/null -w '%{http_code} %{time_total}\n' -X POST \
      -H "Content-Type: application/json" -d "$payload" --max-time 15 "$url" >> "$tmp"
    [[ "$SLEEP" != "0" ]] && sleep "$SLEEP"
  done

  local err
  err=$(awk '$1 !~ /^2/{c++} END{print c+0}' "$tmp")   # non-2xx (incl. 000 = curl failure)

  awk '{print $2}' "$tmp" | sort -n | awk -v lbl="$label" -v err="$err" '
    {t[NR]=$1}
    function q(p,  i){i=int(NR*p); if(i<1)i=1; if(i>NR)i=NR; return t[i]}
    END{
      if(NR==0){printf "%-26s n=0 err=%d  (no samples)\n", lbl, err; exit}
      printf "%-26s n=%-4d err=%-3d  min=%4.0f p50=%4.0f p90=%4.0f p99=%4.0f max=%4.0f ms\n", \
        lbl, NR, err, t[1]*1000, q(0.50)*1000, q(0.90)*1000, q(0.99)*1000, t[NR]*1000
    }'
  rm -f "$tmp"
}

echo "bench: ${REQUESTS} reqs/method, sleep ${SLEEP}s"
echo

for entry in "${METHODS[@]}"; do
  label="${entry%%|*}"
  payload="${entry#*|}"
  bench "kevred / $label" "$URL_KEVRED" "$payload"
  bench "helius / $label" "$URL_HELIUS" "$payload"
  echo
done
