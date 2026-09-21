#!/usr/bin/env bash
# Reminds operators that Docker volume dumps are not off-host DR.
# Exits non-zero when the newest dump is older than MAX_AGE_HOURS (default 36).
#
# Usage:
#   BACKUP_DIR=/var/lib/docker/volumes/.../_data ./scripts/offhost-backup-reminder.sh
#   Or point at a synced off-host directory of .dump files.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-}"
MAX_AGE_HOURS="${MAX_AGE_HOURS:-36}"

if [[ -z "$BACKUP_DIR" ]]; then
  echo "offhost-backup-reminder: set BACKUP_DIR to the dump directory (local volume mount or off-host copy)" >&2
  echo "Copy dumps off-host regularly — a Docker volume alone is not disaster recovery." >&2
  exit 2
fi

if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "offhost-backup-reminder: directory not found: $BACKUP_DIR" >&2
  exit 1
fi

mapfile -t DUMPS < <(find "$BACKUP_DIR" -type f \( -name '*.dump' -o -name '*.sql' -o -name '*.dump.gz' \) -printf '%T@ %p\n' 2>/dev/null | sort -nr)

if [[ ${#DUMPS[@]} -eq 0 ]]; then
  echo "offhost-backup-reminder: no dump files under $BACKUP_DIR" >&2
  exit 1
fi

echo "Newest dumps:"
printf '%s\n' "${DUMPS[@]:0:5}" | while read -r ts path; do
  date -d "@${ts%.*}" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -r "${ts%.*}" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "$ts"
  echo "  $path"
done

NEWEST_TS="${DUMPS[0]%% *}"
NEWEST_EPOCH="${NEWEST_TS%.*}"
NOW_EPOCH="$(date +%s)"
AGE_HOURS=$(( (NOW_EPOCH - NEWEST_EPOCH) / 3600 ))

echo "Newest dump age: ${AGE_HOURS}h (threshold ${MAX_AGE_HOURS}h)"
echo "Reminder: rsync/scp this directory to independent storage on a schedule."

if (( AGE_HOURS > MAX_AGE_HOURS )); then
  echo "offhost-backup-reminder: backup too old" >&2
  exit 1
fi

exit 0
