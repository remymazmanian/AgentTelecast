#!/usr/bin/env bash
# Builds a signed AgentTelecast APK without Gradle: aapt2 -> javac -> d8 -> zipalign -> apksigner.
#
# Needs: JDK 17+, Android SDK with build-tools 35.0.0 and platforms;android-34, zip.
#
# Environment (all optional):
#   ANDROID_HOME        Android SDK path (default ~/android-sdk)
#   APP_ID              application id (default com.remymazmanian.agenttelecast). Change it if you publish your own build.
#   DEMO_HTML           page bundled as the "Try demo" page (default ../web/dist/index.html)
#   BB_KEYSTORE         signing keystore (.jks)
#   BB_KEY_ALIAS        key alias in that keystore (default agenttelecast)
#   BB_KEYSTORE_PASS    file holding the keystore password (default <keystore>.pass)
# Without BB_KEYSTORE, a local key is created once in ./keystore/ (git-ignored). Keep it:
# Android only installs an update over an older install when both are signed with the same key.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
SDK="${ANDROID_HOME:-$HOME/android-sdk}"
BT="$SDK/build-tools/35.0.0"
JAR="$SDK/platforms/android-34/android.jar"
SRC="$ROOT/src"; OUT="$ROOT/build"
APP_ID="${APP_ID:-com.remymazmanian.agenttelecast}"
DEMO_HTML="${DEMO_HTML:-$ROOT/../web/dist/index.html}"
KS="${BB_KEYSTORE:-$ROOT/keystore/agenttelecast-local.jks}"
ALIAS="${BB_KEY_ALIAS:-agenttelecast}"
PW="${BB_KEYSTORE_PASS:-$KS.pass}"

for t in aapt2 d8 zipalign apksigner; do [ -x "$BT/$t" ] || { echo "missing $BT/$t (install build-tools;35.0.0)"; exit 1; }; done
[ -f "$JAR" ] || { echo "missing $JAR (install platforms;android-34)"; exit 1; }
[ -f "$DEMO_HTML" ] || { echo "missing $DEMO_HTML (run: cd ../web && node build.cjs demo/demo-data.json dist/index.html)"; exit 1; }

if [ -z "${BB_KEYSTORE:-}" ] && [ ! -f "$KS" ]; then
  echo "No keystore given; creating a local one at $KS (keep it for future updates)."
  mkdir -p "$(dirname "$KS")"
  ( umask 077
    head -c 24 /dev/urandom | base64 | tr -d '/+=' > "$PW"
    keytool -genkeypair -keystore "$KS" -alias "$ALIAS" -keyalg RSA -keysize 3072 -validity 10000 \
      -storepass:file "$PW" -dname "CN=AgentTelecast local build" >/dev/null )
fi
[ -f "$KS" ] && [ -f "$PW" ] || { echo "keystore or password file not found"; exit 1; }

rm -rf "$OUT"; mkdir -p "$OUT"/{res,gen,classes,dex,assets/agenttelecast}
cp "$DEMO_HTML" "$OUT/assets/agenttelecast/index.html"

"$BT/aapt2" compile --dir "$SRC/res" -o "$OUT/res/res.zip"
"$BT/aapt2" link -o "$OUT/unsigned.apk" -I "$JAR" --manifest "$SRC/AndroidManifest.xml" \
  --rename-manifest-package "$APP_ID" \
  --java "$OUT/gen" --min-sdk-version 21 --target-sdk-version 34 -A "$OUT/assets" "$OUT/res/res.zip"

javac -nowarn -Xlint:-options -source 8 -target 8 -bootclasspath "$JAR" -d "$OUT/classes" \
  $(find "$SRC/java" "$OUT/gen" -name '*.java')

"$BT/d8" --release --min-api 21 --lib "$JAR" --output "$OUT/dex" $(find "$OUT/classes" -name '*.class')
(cd "$OUT/dex" && zip -q -j "$OUT/unsigned.apk" classes.dex)

"$BT/zipalign" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
"$BT/apksigner" sign --ks "$KS" --ks-key-alias "$ALIAS" --ks-pass "file:$PW" \
  --out "$ROOT/AgentTelecast.apk" "$OUT/aligned.apk"
"$BT/apksigner" verify "$ROOT/AgentTelecast.apk"
echo "Built $ROOT/AgentTelecast.apk ($APP_ID)"
