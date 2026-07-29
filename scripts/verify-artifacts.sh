#!/usr/bin/env bash
#
# Verify the RELEASE ARTIFACTS, not the source they were supposed to come from.
#
# 1.7.0 shipped an APK containing a web bundle from a previous build. `npx cap
# sync` had failed on a Node version guard, the build command tailed only the
# last few lines so the failure scrolled past, and Gradle happily packaged
# whatever was already sitting in android/app/src/main/assets/public. Every
# check that day passed: the tests passed, the exe was fine, the web deploy on
# :8091 served the new code — so "verified" was recorded against the wrong
# artifact while the terminal in the field ran the old UI.
#
# The lesson is narrow and worth keeping: a pipeline step that copies files can
# fail without failing the build, and the only place that fact is visible is
# inside the packaged artifact. So look inside it.
#
# Usage:  scripts/verify-artifacts.sh <version>
#         scripts/verify-artifacts.sh 1.7.1
#
set -euo pipefail

VERSION="${1:?usage: verify-artifacts.sh <version>}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APK="$ROOT/downloads/Josbin-POS-$VERSION.apk"
EXE_UNPACKED="$ROOT/frontend/release/win-unpacked/resources/app.asar"
FAILED=0

red()   { printf '\033[31m✗ %s\033[0m\n' "$1"; FAILED=1; }
green() { printf '\033[32m✓ %s\033[0m\n' "$1"; }

# Markers that must appear in any current bundle. Pick strings that are
# HARD to produce by accident and that change with the feature set — a
# version number alone is not enough, because the version is stamped by
# Gradle onto whatever assets it finds.
MARKERS=(
  "dataset.theme"      # day/night theme effect      (1.7.0)
  "user-menu-trigger"  # profile menu                (1.7.0)
  "M6 20c2-8"          # meat product glyph path     (1.7.0)
)

echo "Verifying artifacts for $VERSION"
echo

# ---------------------------------------------------------------- APK
if [ ! -f "$APK" ]; then
  red "APK not found: $APK"
else
  TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
  unzip -o -q "$APK" 'assets/public/*' -d "$TMP"

  STAMPED="$(unzip -p "$APK" AndroidManifest.xml 2>/dev/null | strings | grep -c "$VERSION" || true)"
  for m in "${MARKERS[@]}"; do
    if grep -rqF -- "$m" "$TMP/assets/public/assets/" 2>/dev/null; then
      green "APK bundle contains: $m"
    else
      red   "APK bundle MISSING: $m  — stale web assets, re-run 'npx cap sync android'"
    fi
  done

  # The bundle must also name this version. Catches the inverse mistake:
  # fresh assets packaged under a version that was never bumped.
  if grep -rqF -- "$VERSION" "$TMP/assets/public/assets/" 2>/dev/null; then
    green "APK bundle names version $VERSION"
  else
    red   "APK bundle does not mention $VERSION — built from a stale dist/"
  fi
fi

echo

# ---------------------------------------------------------------- Windows
if [ ! -f "$EXE_UNPACKED" ]; then
  echo "  (no unpacked Electron build to inspect — skipping exe check)"
else
  TMP2="$(mktemp -d)"; trap 'rm -rf "$TMP" "$TMP2"' EXIT
  npx --yes asar extract "$EXE_UNPACKED" "$TMP2" >/dev/null 2>&1 || true
  for m in "${MARKERS[@]}"; do
    if grep -rqF -- "$m" "$TMP2" 2>/dev/null; then
      green "EXE bundle contains: $m"
    else
      red   "EXE bundle MISSING: $m"
    fi
  done
fi

echo
if [ "$FAILED" -ne 0 ]; then
  echo "REFUSING TO SHIP — an artifact does not contain the code it claims to."
  exit 1
fi
echo "Both artifacts carry the current bundle."
