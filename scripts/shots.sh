#!/usr/bin/env bash
# Capture desktop + mobile screenshots of each option prototype for the gallery.
# Usage: scripts/shots.sh [a-forno b-arcade c-valpantena]   (server must run on :5173)
set -euo pipefail
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/options/shots"
PROFILE="$(mktemp -d)"
trap 'rm -rf "$PROFILE"' EXIT
opts=("${@:-a-forno b-arcade c-valpantena}")
for opt in ${opts[@]}; do
  key="${opt%%-*}"
  url="http://127.0.0.1:5173/options/$opt/"
  "$CHROME" --headless=new --user-data-dir="$PROFILE" --hide-scrollbars --mute-audio \
    --use-angle=swiftshader --enable-unsafe-swiftshader --virtual-time-budget=9000 \
    --window-size=1440,900 --force-device-scale-factor=1 \
    --screenshot="$OUT/$key-desktop.png" "$url" >/dev/null 2>&1
  "$CHROME" --headless=new --user-data-dir="$PROFILE" --hide-scrollbars --mute-audio \
    --use-angle=swiftshader --enable-unsafe-swiftshader --virtual-time-budget=9000 \
    --window-size=390,844 --force-device-scale-factor=2 \
    --user-agent="Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" \
    --screenshot="$OUT/$key-mobile.png" "$url" >/dev/null 2>&1
  python3 - "$OUT" "$key" <<'PY'
import sys
from PIL import Image
out, key = sys.argv[1], sys.argv[2]
for kind, w in (("desktop", 1440), ("mobile", 780)):
    p = f"{out}/{key}-{kind}.png"
    im = Image.open(p).convert("RGB")
    im.thumbnail((w, 10000))
    im.save(f"{out}/{key}-{kind}.jpg", quality=84, optimize=True, progressive=True)
    print(f"{key}-{kind}.jpg", im.size)
PY
  rm -f "$OUT/$key-desktop.png" "$OUT/$key-mobile.png"
done
