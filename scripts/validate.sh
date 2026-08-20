#!/usr/bin/env bash
#
# pi-polished-ui health check. Run after installing or upgrading Pi.
#
# Checks:
#   1. prerequisites (node, pi)
#   2. extension + theme installed (follows symlinks)
#   3. theme file parses as JSON
#   4. theme schema + every token resolves via Pi's own loader
#   5. required Pi extension/TUI APIs still exist in the installed package
#   6. extension imports through Pi's loader (jiti) and responsive render
#      invariants hold (header/lane/editor/footer at 160/120/90/60/40)
#
# Env overrides: PI_PKG (pi package dir), PI_AGENT_DIR, PI_PKG_ROOT.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
AGENT_DIR="${PI_AGENT_DIR:-$HOME/.pi/agent}"
EXT_DIR="$AGENT_DIR/extensions/polished-ui"
THEME_FILE="$AGENT_DIR/themes/hariz-dark.json"
AIR_THEME_FILE="$AGENT_DIR/themes/aira-zhr.json"
OUT="$SCRIPT_DIR/out"
mkdir -p "$OUT"

fail=0
ok()   { printf '  \033[32mOK\033[0m  %s\n' "$*"; }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$*"; fail=1; }

echo "pi-polished-ui validate"
echo "  repo:    $ROOT"
echo "  agent:   $AGENT_DIR"
echo ""

# --- 1. prerequisites -----------------------------------------------------
command -v node >/dev/null 2>&1 || { bad "node not found on PATH"; exit 1; }
command -v pi   >/dev/null 2>&1 || { bad "pi not found on PATH"; exit 1; }

PI_PKG="${PI_PKG:-}"
if [[ -z "$PI_PKG" || ! -d "$PI_PKG" ]]; then
  GLOBAL_ROOT="$(npm root -g 2>/dev/null || true)"
  PI_PKG="${GLOBAL_ROOT%/}/@earendil-works/pi-coding-agent"
fi
if [[ ! -d "$PI_PKG" ]]; then
  bad "cannot locate the pi package (set PI_PKG to its directory)"
  exit 1
fi
ok "pi package: $PI_PKG"

# --- 2. install presence --------------------------------------------------
[[ -d "$EXT_DIR" ]]  || bad "extension not installed: $EXT_DIR"
[[ -f "$THEME_FILE" ]] || bad "theme not installed: $THEME_FILE"
[[ -f "$AIR_THEME_FILE" ]] || bad "theme not installed: $AIR_THEME_FILE"
if [[ -f "$EXT_DIR/index.ts" ]]; then ok "extension present ($EXT_DIR)"; else bad "extension index.ts missing"; fi
[ -f "$THEME_FILE" ] && ok "theme present ($THEME_FILE)"
[ -f "$AIR_THEME_FILE" ] && ok "theme present ($AIR_THEME_FILE)"

# --- 3. theme parses as JSON ----------------------------------------------
for TF in "$THEME_FILE" "$AIR_THEME_FILE"; do
  node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' "$TF" >/dev/null 2>"$OUT/json.err" \
    && ok "theme parses as JSON ($(basename "$TF"))" || { bad "theme JSON invalid ($(basename "$TF")):"; cat "$OUT/json.err" >&2; }
done

# --- 4/5/6. theme schema + API surface + import/render invariants ---------
for TF in "$THEME_FILE" "$AIR_THEME_FILE"; do
  PI_PKG="$PI_PKG" PI_AGENT_DIR="$AGENT_DIR" THEME_FILE="$TF" \
    node "$SCRIPT_DIR/validate.mjs" >>"$OUT/validate.log" 2>&1 \
    && ok "theme schema + tokens + import + render invariants ($(basename "$TF"))" \
    || { bad "validate.mjs failed ($(basename "$TF")):"; cat "$OUT/validate.log" >&2; }
  tail -n 6 "$OUT/validate.log" | sed 's/^/      /' || true
done

# --- exit -----------------------------------------------------------------
echo ""
if [[ "$fail" -eq 0 ]]; then
  echo "ALL CHECKS PASSED."
else
  echo "SOME CHECKS FAILED — see above."
fi
exit "$fail"
