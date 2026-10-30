#!/usr/bin/env bash
# Daily backup of BUKJA on the server (run by bukja-backup.timer): a database dump and a snapshot
# of the photos, keeping 14 days. Photo snapshots share unchanged files (hard links), so each day
# costs only the new photos. These copies live on the same server: they protect against mistakes,
# not against losing the server, so copy /var/backups/bukja somewhere else from time to time.
set -euo pipefail

DIR=/var/backups/bukja
KEEP_DAYS=14
DAY="$(date +%F)"
install -d -m 700 "$DIR" "$DIR/uploads"

sudo -u postgres pg_dump --format=custom bukja > "$DIR/db-$DAY.dump.tmp"
mv "$DIR/db-$DAY.dump.tmp" "$DIR/db-$DAY.dump"

# Link to the newest earlier snapshot, so unchanged photos are not stored twice.
LAST="$(ls -1d "$DIR"/uploads/20* 2>/dev/null | grep -v "/$DAY\$" | tail -n 1 || true)"
rsync -a --delete ${LAST:+--link-dest="$LAST"} /var/lib/bukja/uploads/ "$DIR/uploads/$DAY/"

# Old copies go by the date in their name (rsync gives a snapshot the photos' own times).
CUTOFF="$(date -d "-$KEEP_DAYS days" +%F)"
for f in "$DIR"/db-*.dump; do
  [ -e "$f" ] || continue
  d="$(basename "$f" .dump)"; d="${d#db-}"
  if [[ "$d" < "$CUTOFF" ]]; then rm -f "$f"; fi
done
for s in "$DIR"/uploads/20*; do
  [ -d "$s" ] || continue
  if [[ "$(basename "$s")" < "$CUTOFF" ]]; then rm -rf "$s"; fi
done
echo "backup $DAY done"
