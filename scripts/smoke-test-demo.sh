#!/usr/bin/env bash
# Proactive smoke test against the demo stack.
#
# All HTTP calls go *through the app container* (not host curl) so the source
# IP that nginx sees is the app container's docker-network address. This avoids
# fighting with the host's logged-in browser tabs (dashboard / POS dev server)
# for the same per-IP rate-limit bucket, which makes the test deterministic.
#
# Usage: bash scripts/smoke-test-demo.sh
set -uo pipefail

BASE="http://nginx"          # service name in the demo docker network
APP="josbin_demo_app"

red()    { printf '\033[31m%s\033[0m\n' "$1"; }
green()  { printf '\033[32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[33m%s\033[0m\n' "$1"; }
bold()   { printf '\033[1m%s\033[0m\n' "$1"; }

failures=0
fail_log=()

# in-container curl: ensures source IP isolation from host browsers.
ccurl() { docker exec "$APP" curl "$@"; }

hit() {
  # hit <label> <expected-status> <method> <path> [--token <t>] [--body <json>]
  local label="$1" expected="$2" method="$3" path="$4"
  shift 4
  local token="" body=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --token) token="$2"; shift 2;;
      --body)  body="$2";  shift 2;;
      *)       shift;;
    esac
  done

  local args=(-s -o /tmp/smoke.body -w "%{http_code}" -X "$method" "${BASE}${path}")
  args+=(-H "Accept: application/json")
  [ -n "$token" ] && args+=(-H "Authorization: Bearer ${token}")
  if [ -n "$body" ]; then
    args+=(-H "Content-Type: application/json" --data "$body")
  fi

  local code
  code="$(ccurl "${args[@]}")"

  if [ "$code" = "$expected" ]; then
    green "  OK  [$code] $label"
  else
    red   "  FAIL [$code, expected $expected] $label"
    docker exec "$APP" sh -c 'head -c 300 /tmp/smoke.body 2>/dev/null' || true
    echo
    failures=$((failures + 1))
    fail_log+=("[$code, expected $expected] $label")
  fi
  sleep 0.4
}

login() {
  local email="$1" pass="$2"
  ccurl -s -X POST "${BASE}/api/auth/login" \
    -H 'Accept: application/json' -H 'Content-Type: application/json' \
    --data "{\"email\":\"${email}\",\"password\":\"${pass}\"}" \
  | docker exec -i "$APP" php -r 'echo json_decode(file_get_contents("php://stdin"), true)["token"] ?? "";'
}

bold "==> clearing demo laravel.log"
docker exec "$APP" sh -c ': > storage/logs/laravel.log' || true

bold "==> logging in roles"
# Login zone is 5r/m + burst 3 — pace logins with 13s gaps
T_CASH="$(login 'kassa@dehoop.sr'    'Cashier@2026')"
sleep 13
T_MGR="$(login  'manager@dehoop.sr'  'Manager@2026')"
sleep 13
T_OA="$(login   'orgadmin@dehoop.sr' 'OrgAdmin@2026')"
sleep 13

for n in CASH MGR OA; do
  v="T_${n}"
  tok="${!v}"
  if [ -z "$tok" ]; then red "  login FAILED: $n"; failures=$((failures+1)); else green "  login ok: $n (len=${#tok})"; fi
done

bold "==> fetching ids from demo db"
IDS_JSON="$(docker exec "$APP" php artisan tinker --execute='
  $org = \App\Models\Organisation::first();
  $store = \App\Models\Store::where("organisation_id", $org->id)->first();
  $reg = \App\Models\Register::where("store_id", $store->id)->first();
  $session = \App\Models\RegisterSession::where("register_id", $reg?->id)->latest("opened_at")->first();
  $product = \App\Models\Product::where("organisation_id", $org->id)->first();
  $sale = \App\Models\Sale::where("store_id", $store->id)->latest()->first();
  $cust = \App\Models\Customer::where("organisation_id", $org->id)->first();
  echo json_encode([
    "org" => $org?->id, "store" => $store?->id, "register" => $reg?->id,
    "session" => $session?->id, "product" => $product?->id,
    "sale" => $sale?->id, "customer" => $cust?->id,
  ]);
' 2>/dev/null | tail -1)"
echo "  $IDS_JSON"

ORG=$(echo      "$IDS_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("org") or "")')
STORE=$(echo    "$IDS_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("store") or "")')
REGISTER=$(echo "$IDS_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("register") or "")')
SESSION=$(echo  "$IDS_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("session") or "")')
PRODUCT=$(echo  "$IDS_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("product") or "")')
SALE=$(echo     "$IDS_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("sale") or "")')
CUSTOMER=$(echo "$IDS_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("customer") or "")')

echo "  org=$ORG"
echo "  store=$STORE  register=$REGISTER  session=$SESSION"
echo "  product=$PRODUCT  sale=$SALE  customer=$CUSTOMER"

# ---------- public endpoints ----------
bold "==> public endpoints"
hit "GET /api/health"          200 GET /api/health
hit "GET /api/environment"     200 GET /api/environment
hit "GET /api/v1/docs"         200 GET /api/v1/docs
hit "GET /api/v1/openapi.json" 200 GET /api/v1/openapi.json

# ---------- /me for each role ----------
for role in CASH MGR OA; do
  bold "==> /me as $role"
  v="T_${role}"; tok2="${!v}"
  hit "$role: GET /api/auth/me"             200 GET /api/auth/me            --token "$tok2"
  hit "$role: GET /api/me/sales-summary"    200 GET /api/me/sales-summary   --token "$tok2"
  hit "$role: GET /api/me/shifts"           200 GET /api/me/shifts          --token "$tok2"
done

# ---------- cashier POS flow ----------
bold "==> cashier POS flow"
hit "CASH: GET /api/products?store_id"        200 GET "/api/products?store_id=${STORE}" --token "$T_CASH"
hit "CASH: GET /api/products/pos?store_id"    200 GET "/api/products/pos?store_id=${STORE}" --token "$T_CASH"
hit "CASH: GET /api/categories"               200 GET /api/categories --token "$T_CASH"
hit "CASH: GET /api/customers"                200 GET /api/customers --token "$T_CASH"
hit "CASH: GET /api/rates"                    200 GET /api/rates --token "$T_CASH"
hit "CASH: GET /api/registers?store_id"       200 GET "/api/registers?store_id=${STORE}" --token "$T_CASH"
hit "CASH: GET /api/registers/my-session"     200 GET "/api/registers/my-session?store_id=${STORE}" --token "$T_CASH"
hit "CASH: GET /api/sales (own scope)"        200 GET "/api/sales?store_id=${STORE}" --token "$T_CASH"
[ -n "$SALE" ] && hit "CASH: GET /api/sales/{id}" 200 GET "/api/sales/${SALE}" --token "$T_CASH"
hit "CASH: GET /api/discount-rules"           200 GET /api/discount-rules --token "$T_CASH"
hit "CASH: GET /api/sales/held"               200 GET "/api/sales/held?store_id=${STORE}" --token "$T_CASH"
hit "CASH: GET /api/ai/product-search"        200 GET "/api/ai/product-search?q=brood" --token "$T_CASH"

# ---------- manager screens ----------
bold "==> manager screens"
hit "MGR: GET /api/stores"                       200 GET /api/stores --token "$T_MGR"
hit "MGR: GET /api/registers?store_id"           200 GET "/api/registers?store_id=${STORE}" --token "$T_MGR"
hit "MGR: GET /api/registers/sessions?store_id"  200 GET "/api/registers/sessions?store_id=${STORE}" --token "$T_MGR"
hit "MGR: GET /api/users"                        200 GET /api/users --token "$T_MGR"
hit "MGR: GET /api/products?store_id"            200 GET "/api/products?store_id=${STORE}" --token "$T_MGR"
hit "MGR: GET /api/sales?store_id"               200 GET "/api/sales?store_id=${STORE}" --token "$T_MGR"
hit "MGR: GET /api/reports/daily"                200 GET "/api/reports/daily?store_id=${STORE}" --token "$T_MGR"
hit "MGR: GET /api/reports/monthly"              200 GET "/api/reports/monthly?store_id=${STORE}&year=2026&month=5" --token "$T_MGR"
hit "MGR: GET /api/reports/top-products"         200 GET "/api/reports/top-products?store_id=${STORE}" --token "$T_MGR"
hit "MGR: GET /api/reports/x-report"             200 GET "/api/reports/x-report?store_id=${STORE}" --token "$T_MGR"
hit "MGR: GET /api/reports/z-report/history"     200 GET "/api/reports/z-report/history?store_id=${STORE}" --token "$T_MGR"
hit "MGR: GET /api/reports/btw"                  200 GET "/api/reports/btw?store_id=${STORE}&date_from=2026-05-01&date_to=2026-05-31" --token "$T_MGR"
hit "MGR cannot GET /api/audit-log (SA/OA/AU)"   403 GET /api/audit-log --token "$T_MGR"
hit "MGR: GET /api/customers"                    200 GET /api/customers --token "$T_MGR"
hit "MGR: GET /api/categories"                   200 GET /api/categories --token "$T_MGR"
hit "MGR: GET /api/rates"                        200 GET /api/rates --token "$T_MGR"
hit "MGR: GET /api/dashboard/summary"            200 GET /api/dashboard/summary --token "$T_MGR"

# ---------- org admin extras ----------
bold "==> org admin extras"
hit "OA: GET /api/organisations"                  200 GET /api/organisations --token "$T_OA"
hit "OA: GET /api/api-keys"                       200 GET /api/api-keys --token "$T_OA"
hit "OA: GET /api/discount-rules"                 200 GET /api/discount-rules --token "$T_OA"
hit "OA: GET /api/ai/weekly-summary"              200 GET "/api/ai/weekly-summary?store_id=${STORE}" --token "$T_OA"
hit "OA: GET /api/ai/anomalies"                   200 GET "/api/ai/anomalies?store_id=${STORE}" --token "$T_OA"
hit "OA: GET /api/users"                          200 GET /api/users --token "$T_OA"
hit "OA: GET /api/dashboard/reports/btw"          200 GET "/api/dashboard/reports/btw?date_from=2026-05-01&date_to=2026-05-31" --token "$T_OA"
hit "OA: GET /api/dashboard/z-reports"            200 GET /api/dashboard/z-reports --token "$T_OA"
hit "OA: GET /api/dashboard/reports/consolidated" 200 GET "/api/dashboard/reports/consolidated?date_from=2026-05-01&date_to=2026-05-31" --token "$T_OA"
hit "OA: GET /api/licenses"                       200 GET /api/licenses --token "$T_OA"
# License create/edit are SA-only (and SA has 2FA on demo). Verify the OA
# correctly gets 403 instead of being silently allowed.
hit "OA cannot POST /api/licenses (SA-only)"      403 POST /api/licenses --token "$T_OA" --body '{"organisation_id":"00000000-0000-0000-0000-000000000000","tier":"standard","max_stores":1,"max_terminals":1,"valid_from":"2026-05-26","valid_until":"2027-05-26"}'

# Store-assignment endpoints exposed for OA via the user-create flow.
# Just probe that the users endpoint round-trips store_ids[] (a 200 OK is
# enough; pivot correctness is covered by tests/Feature/UserStoreAssignmentTest).
hit "OA: GET /api/users (sees store_ids)"         200 GET /api/users --token "$T_OA"
hit "OA: GET /api/audit-log"                      200 GET /api/audit-log --token "$T_OA"
hit "OA: GET /api/settings/two-factor-policy"     403 GET /api/settings/two-factor-policy --token "$T_OA"

# ---------- negative checks (cashier cannot reach HQ data) ----------
bold "==> negative checks"
hit "CASH cannot GET /api/organisations"          403 GET /api/organisations --token "$T_CASH"
hit "CASH cannot GET /api/users"                  403 GET /api/users --token "$T_CASH"
hit "CASH cannot GET /api/audit-log"              403 GET /api/audit-log --token "$T_CASH"
hit "CASH cannot GET /api/api-keys"               403 GET /api/api-keys --token "$T_CASH"
hit "CASH cannot GET /api/ai/weekly-summary"      403 GET "/api/ai/weekly-summary?store_id=${STORE}" --token "$T_CASH"
hit "CASH cannot GET /api/ai/anomalies"           403 GET "/api/ai/anomalies?store_id=${STORE}" --token "$T_CASH"
hit "CASH cannot GET /api/settings/two-factor-policy" 403 GET /api/settings/two-factor-policy --token "$T_CASH"

bold "==> fresh exceptions in laravel.log"
EXC="$(docker exec "$APP" sh -c 'grep -cE "ERROR:|Exception|TypeError|InvalidArgument|QueryException" storage/logs/laravel.log || true')"
echo "  exception-ish lines: $EXC"
if [ "${EXC:-0}" -gt 0 ]; then
  yellow "  ---- log excerpt ----"
  docker exec "$APP" sh -c 'grep -nE "ERROR:|Exception|TypeError|InvalidArgument|QueryException" storage/logs/laravel.log | head -40' || true
fi

echo
if [ "$failures" -eq 0 ]; then
  green "==> SMOKE TEST PASSED (0 failures)"
else
  red "==> SMOKE TEST: $failures FAILURE(S)"
  for f in "${fail_log[@]}"; do echo "  - $f"; done
fi
exit "$failures"
