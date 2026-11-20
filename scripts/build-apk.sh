#!/usr/bin/env bash
# Build UNBOUND APK. Usage: scripts/build-apk.sh [debug|release]
# Env overrides: UNBOUND_RELEASES_DIR (default: releases), UNBOUND_BUILDS_DIR (default: builds)
set -euo pipefail

MODE="${1:-debug}"
case "$MODE" in debug|release) ;; *) echo "Usage: $0 [debug|release]" >&2; exit 2;; esac

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
fail() { echo "ERROR: $*" >&2; exit 1; }
step() { echo; echo "==> $*"; }

RELEASES_DIR="${UNBOUND_RELEASES_DIR:-$ROOT/releases}"
BUILDS_DIR="${UNBOUND_BUILDS_DIR:-$ROOT/builds}"
KEYPROPS="$ROOT/android-signing/keystore.properties"

step "1/9 Checking environment"
command -v java >/dev/null || fail "java not found"
command -v node >/dev/null || fail "node not found"
: "${ANDROID_HOME:=${ANDROID_SDK_ROOT:-}}"
[ -n "$ANDROID_HOME" ] && [ -d "$ANDROID_HOME" ] || fail "ANDROID_HOME is not set or not a directory"
export ANDROID_HOME ANDROID_SDK_ROOT="$ANDROID_HOME"
BT_DIR="$(ls -d "$ANDROID_HOME"/build-tools/*/ 2>/dev/null | sort -V | tail -1 || true)"
BT_DIR="${BT_DIR%/}"
[ -n "$BT_DIR" ] || fail "no build-tools in $ANDROID_HOME"
APKSIGNER="$BT_DIR/apksigner"; AAPT2="$BT_DIR/aapt2"
[ -x "$APKSIGNER" ] && [ -x "$AAPT2" ] || fail "apksigner/aapt2 missing in $BT_DIR"
echo "java: $(java -version 2>&1 | grep -v 'Picked up' | head -1) | node: $(node -v) | build-tools: $(basename "$BT_DIR")"

# cert SHA-256 normalised: lowercase hex, no colons
norm() { tr -d ': \r' | tr 'A-F' 'a-f'; }
prop() { grep -E "^$1=" "$KEYPROPS" | head -1 | cut -d= -f2- | tr -d '\r'; }

EXPECTED_SHA=""
if [ "$MODE" = release ]; then
  step "2/9 Checking signing files"
  [ -f "$KEYPROPS" ] || fail "missing $KEYPROPS"
  STORE_REL="$(prop storeFile)"
  [ -f "$ROOT/android/$STORE_REL" ] || fail "keystore not found: android/$STORE_REL"
  EXPECTED_SHA="$(prop certSha256 | norm)"
  [ -n "$EXPECTED_SHA" ] || fail "certSha256 missing in keystore.properties"
  echo "keystore: android/$STORE_REL; expected cert SHA-256: $EXPECTED_SHA"
else
  step "2/9 Signing files: not needed for debug"
fi

step "3/9 Reading version.json"
read_json() { node -e "const v=require('./version.json');console.log(v['$1'])"; }
APP_ID="$(read_json applicationId)"; VERSION_NAME="$(read_json versionName)"; VERSION_CODE="$(read_json versionCode)"
echo "applicationId=$APP_ID versionName=$VERSION_NAME versionCode=$VERSION_CODE"
if [ "$MODE" = release ]; then
  LAST="$RELEASES_DIR/last-release.json"
  if [ -f "$LAST" ]; then
    LAST_CODE="$(node -e "console.log(require('$LAST').versionCode)")"
    [ "$VERSION_CODE" -gt "$LAST_CODE" ] || fail "versionCode $VERSION_CODE must be greater than last release's $LAST_CODE (bump version.json)"
    echo "versionCode $VERSION_CODE > last released $LAST_CODE: ok"
  else
    echo "no previous release recorded: ok"
  fi
fi

step "4/9 Building web and syncing Capacitor"
npm run build
npx cap sync android

step "5/9 Gradle assemble${MODE^}"
( cd android && ./gradlew --no-daemon "assemble${MODE^}" )
if [ "$MODE" = release ]; then SRC="android/app/build/outputs/apk/release/app-release.apk"
else SRC="android/app/build/outputs/apk/debug/app-debug.apk"; fi
[ -f "$SRC" ] || fail "gradle did not produce $SRC"

step "6/9 Verifying signature"
CERTS="$("$APKSIGNER" verify --print-certs "$SRC")" || fail "apksigner verify failed"
echo "$CERTS"
ACTUAL_SHA="$(echo "$CERTS" | grep -m1 'certificate SHA-256 digest' | awk -F': ' '{print $2}' | norm)"
[ -n "$ACTUAL_SHA" ] || fail "could not read certificate SHA-256"
if [ "$MODE" = release ]; then
  [ "$ACTUAL_SHA" = "$EXPECTED_SHA" ] || fail "cert SHA-256 mismatch: got $ACTUAL_SHA expected $EXPECTED_SHA"
  echo "cert SHA-256 matches keystore.properties: ok"
fi

step "7/9 Verifying package metadata"
BADGING="$("$AAPT2" dump badging "$SRC")"
PKG_LINE="$(echo "$BADGING" | grep -m1 '^package:')"
echo "$PKG_LINE"
echo "$PKG_LINE" | grep -q "name='$APP_ID'" || fail "applicationId in APK differs from $APP_ID"
echo "$PKG_LINE" | grep -q "versionCode='$VERSION_CODE'" || fail "versionCode in APK differs from $VERSION_CODE"
EXPECT_VN="$VERSION_NAME"; [ "$MODE" = debug ] && EXPECT_VN="$VERSION_NAME-debug"
echo "$PKG_LINE" | grep -q "versionName='$EXPECT_VN'" || fail "versionName in APK differs from $EXPECT_VN"

step "8/9 Copying artifact"
SIZE="$(stat -c %s "$SRC")"
if [ "$MODE" = release ]; then
  mkdir -p "$RELEASES_DIR"
  DEST="$RELEASES_DIR/UNBOUND-v$VERSION_NAME.apk"
  cp "$SRC" "$DEST"
  BUILT_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  cat > "$RELEASES_DIR/last-release.json" <<JSON
{
  "versionName": "$VERSION_NAME",
  "versionCode": $VERSION_CODE,
  "certSha256": "$ACTUAL_SHA",
  "builtAt": "$BUILT_AT",
  "sizeBytes": $SIZE
}
JSON
else
  mkdir -p "$BUILDS_DIR"
  DEST="$BUILDS_DIR/UNBOUND-v$VERSION_NAME-debug.apk"
  cp "$SRC" "$DEST"
fi

step "9/9 Report"
echo "mode:          $MODE"
echo "file:          $DEST"
echo "size:          $SIZE bytes"
echo "applicationId: $APP_ID"
echo "versionName:   $EXPECT_VN"
echo "versionCode:   $VERSION_CODE"
echo "cert SHA-256:  $ACTUAL_SHA"
[ "$MODE" = release ] && echo "last-release:  $RELEASES_DIR/last-release.json updated"
echo "BUILD OK"
