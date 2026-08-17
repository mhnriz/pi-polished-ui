#!/usr/bin/env bash
#
# pi-polished-ui installer.
#
# Modes:
#   ./scripts/install.sh            copy installation (default)
#   ./scripts/install.sh --dev      symlink development installation (--symlink alias)
#   ./scripts/install.sh --uninstall
#
# Behavior (safe & idempotent):
#   - creates ~/.pi/agent/extensions and ~/.pi/agent/themes if missing
#   - detects an existing polished-ui install (real dir/file or symlink)
#   - before replacing anything non-matching, moves it to a timestamped backup
#     (*.bak-<timestamp>) — never silently destroys an existing installation
#   - a symlink that already points to THIS repo is left alone (idempotent)
#   - reports exactly what it changed
#
# Targets:
#   ~/.pi/agent/extensions/polished-ui        -> <repo>/extension
#   ~/.pi/agent/themes/hariz-dark.json        -> <repo>/themes/hariz-dark.json
#
# Override the agent dir with PI_AGENT_DIR, e.g.:
#   PI_AGENT_DIR=/srv/pi/agent ./scripts/install.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

MODE="copy"
for arg in "$@"; do
  case "$arg" in
    --dev|--symlink) MODE="dev" ;;
    --uninstall) MODE="uninstall" ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

AGENT_DIR="${PI_AGENT_DIR:-$HOME/.pi/agent}"
EXT_BASE="$AGENT_DIR/extensions"
THEMES_BASE="$AGENT_DIR/themes"
EXT_TARGET="$EXT_BASE/polished-ui"
THEME_TARGET="$THEMES_BASE/hariz-dark.json"
SRC_EXT="$ROOT/extension"
SRC_THEME="$ROOT/themes/hariz-dark.json"

mkdir -p "$EXT_BASE" "$THEMES_BASE"

TS="$(date +%Y%m%d-%H%M%S)"
summary=()
backup() { # $1 = path
  local p="$1"
  mv "$p" "$p.bak-$TS"
  summary+=("  backup: $p -> $p.bak-$TS")
}

# returns 0 when $1 exists and is a symlink pointing into $ROOT
points_at_repo() {
  [[ -L "$1" ]] && [[ "$(readlink "$1")" == "$ROOT"/* ]]
}

install_extension() {
  if [[ -L "$EXT_TARGET" ]]; then
    if points_at_repo "$EXT_TARGET"; then
      summary+=("  unchanged (symlink already -> repo): $EXT_TARGET")
      return
    fi
    backup "$EXT_TARGET"
  elif [[ -e "$EXT_TARGET" ]]; then
    backup "$EXT_TARGET"
  fi
  if [[ "$MODE" == "dev" ]]; then
    ln -s "$SRC_EXT" "$EXT_TARGET"
    summary+=("  symlink: $EXT_TARGET -> $SRC_EXT")
  else
    cp -R "$SRC_EXT" "$EXT_TARGET"
    summary+=("  copied:  $SRC_EXT -> $EXT_TARGET")
  fi
}

install_theme() {
  if [[ -L "$THEME_TARGET" ]]; then
    if points_at_repo "$THEME_TARGET"; then
      summary+=("  unchanged (symlink already -> repo): $THEME_TARGET")
      return
    fi
    backup "$THEME_TARGET"
  elif [[ -e "$THEME_TARGET" ]]; then
    backup "$THEME_TARGET"
  fi
  if [[ "$MODE" == "dev" ]]; then
    ln -s "$SRC_THEME" "$THEME_TARGET"
    summary+=("  symlink: $THEME_TARGET -> $SRC_THEME")
  else
    cp "$SRC_THEME" "$THEME_TARGET"
    summary+=("  copied:  $SRC_THEME -> $THEME_TARGET")
  fi
}

uninstall_target() { # $1 = target
  if [[ -L "$1" ]]; then
    if points_at_repo "$1"; then
      rm "$1"; summary+=("  removed symlink: $1")
    else
      backup "$1" # symlink not ours — preserve
    fi
  elif [[ -e "$1" ]]; then
    backup "$1" # real install — move aside, never rm
  else
    summary+=("  not installed: $1")
  fi
}

echo "pi-polished-ui install ($MODE)"
echo "  repo:  $ROOT"
echo "  agent: $AGENT_DIR"
echo ""

if [[ "$MODE" == "uninstall" ]]; then
  uninstall_target "$EXT_TARGET"
  uninstall_target "$THEME_TARGET"
else
  install_extension
  install_theme
fi

echo "Result:"
printf '%s\n' "${summary[@]:-  nothing to do}"
echo ""
if [[ "$MODE" != "uninstall" ]]; then
  echo "Next steps:"
  echo "  ./scripts/validate.sh"
  echo "  pi --use-theme hariz-dark   (or set \"theme\": \"hariz-dark\" in ~/.pi/agent/settings.json)"
  echo "  back in pi: /reload"
fi
