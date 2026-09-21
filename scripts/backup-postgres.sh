#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

backup_dir="${BACKUP_DIR:-./backups}"
mkdir -p "$backup_dir"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$backup_dir/sales-$timestamp.dump"
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" --file="$target"
echo "$target"

upload_dir="${UPLOAD_DIR:-}"
if [ -n "$upload_dir" ] && [ -d "$upload_dir" ]; then
  uploads_target="$backup_dir/uploads-$timestamp.tar.gz"
  tar -czf "$uploads_target" -C "$upload_dir" .
  echo "$uploads_target"
fi
