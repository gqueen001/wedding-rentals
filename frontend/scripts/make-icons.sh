#!/bin/sh
# Renders the PWA icons from icons-src/*.svg with macOS's built-in Quick Look (qlmanage).
# Re-run after changing an SVG; the PNGs are committed so builds need no image tools.
set -eu
cd "$(dirname "$0")/.."
out=public/icons
tmp=$(mktemp -d)
mkdir -p "$out"

render() { # source.svg size output.png
  qlmanage -t -s "$2" -o "$tmp" "$1" >/dev/null 2>&1
  mv "$tmp/$(basename "$1").png" "$out/$3"
}

render icons-src/icon.svg 512 icon-512.png
render icons-src/icon.svg 192 icon-192.png
render icons-src/maskable.svg 180 apple-touch-icon.png
render icons-src/maskable.svg 512 maskable-512.png
cp icons-src/icon.svg public/favicon.svg
rm -rf "$tmp"
echo "icons written to $out"
