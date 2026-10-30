#!/usr/bin/env bash
# Builds BUKJA on this computer, copies it to the server and restarts it (a few seconds' pause).
# The database updates itself on start. Run from anywhere:
#
#   deploy/deploy.sh [ssh-host]      # default host: bukja, an alias in ~/.ssh/config
set -euo pipefail

HOST="${1:-bukja}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/backend/bin/deploy"

case "$(ssh "$HOST" uname -m)" in
  x86_64) ARCH=amd64 ;;
  aarch64) ARCH=arm64 ;;
  *) echo "unknown server CPU" >&2; exit 1 ;;
esac

echo "== build the site"
(cd "$ROOT/frontend" && deno task build)

echo "== build the server for linux/$ARCH"
mkdir -p "$OUT"
(cd "$ROOT/backend" &&
  CGO_ENABLED=0 GOOS=linux GOARCH="$ARCH" go build -trimpath -ldflags="-s -w" -o "$OUT/server" ./cmd/server &&
  CGO_ENABLED=0 GOOS=linux GOARCH="$ARCH" go build -trimpath -ldflags="-s -w" -o "$OUT/admin" ./cmd/admin)

echo "== copy to $HOST"
rsync -az --delete "$ROOT/frontend/dist/" "$HOST:/opt/bukja/web/"
rsync -az "$OUT/server" "$OUT/admin" "$HOST:/opt/bukja/"

echo "== restart"
ssh "$HOST" 'chown -R bukja:bukja /opt/bukja && systemctl restart bukja &&
  for i in $(seq 1 20); do curl -fsS http://127.0.0.1:8080/api/health >/dev/null 2>&1 && break; sleep 1; done &&
  curl -fsS http://127.0.0.1:8080/api/health && echo && systemctl is-active bukja'
echo "== deployed"
