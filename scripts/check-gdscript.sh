#!/usr/bin/env bash
# Engine GDScript parse gate — regression pin for the v1.0.0 finding that the
# companion addon shipped with parse errors no mock harness could catch
# (same-line suite in connection.gd, String.is_valid_node_name, wrong
# _has_capture override, uninferrable :=). Stages companion/ into a throwaway
# Godot project and --check-only compiles every .gd file.
#
# Usage:
#   scripts/check-gdscript.sh [--godot-bin "<bin>"]
#   GODOT_BIN env is honored when the flag is absent. The binary may be a
#   multi-word launcher, e.g.:
#     scripts/check-gdscript.sh --godot-bin "flatpak run --branch=stable --arch=x86_64 --command=godot org.godotengine.Godot"
# No binary on PATH -> prints "unavailable" and exits 0 (CI-tolerated,
# mirroring the verify/ unavailable legs). Any SCRIPT ERROR -> exit 1.
set -u

BIN="${GODOT_BIN:-godot}"
if [ "${1:-}" = "--godot-bin" ]; then
  BIN="${2:?missing binary after --godot-bin}"
fi
# shellcheck disable=SC2086
if ! command -v ${BIN%% *} >/dev/null 2>&1; then
  echo "check-gdscript: unavailable (no Godot binary) — skipped"
  exit 0
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Stage under $HOME: Flatpak-sandboxed engines cannot see /tmp, so mktemp(1)'s
# default glimpse outside the sandbox. A cache dir in $HOME is visible both
# inside and outside the sandbox.
STAGE_BASE="${XDG_CACHE_HOME:-$HOME/.cache}/godot-parse-gate"
mkdir -p "$STAGE_BASE"
STAGE="$(mktemp -d "$STAGE_BASE/stage.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/addons"
cp -r "$ROOT/companion/addons/godot_opencode" "$STAGE/addons/godot_opencode"
cp "$ROOT/companion/validate_scene.gd" "$STAGE/validate_scene.gd"
printf 'config_version=5\n\n[application]\nconfig/name="ParseGate"\n' > "$STAGE/project.godot"

count=0
fail=0
while IFS= read -r f; do
  count=$((count + 1))
  rel="res://${f#$STAGE/}"
  # shellcheck disable=SC2086
  if ! out=$($BIN --headless --path "$STAGE" --check-only --script "$rel" 2>&1); then
    echo "FAIL: $rel"
    printf '%s\n' "$out" | grep "SCRIPT ERROR" | head -n 3
    fail=1
  fi
done < <(find "$STAGE" -name "*.gd")

if [ "$fail" -ne 0 ]; then
  echo "check-gdscript: FAIL ($count files)"
  exit 1
fi
echo "check-gdscript: ok ($count files)"
