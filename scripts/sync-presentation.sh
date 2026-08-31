#!/bin/sh
# Mirrors the committed presentation deck (present/) into public/presentation/
# so Next.js serves it at /presentation. Runs as a prebuild step, so the
# latest deck is always baked into the production image without any manual
# step. Idempotent: removes the previous mirror first so deleted files
# don't linger.
#
# POSIX sh (no bash) — the build container is minimal and may not ship bash.
set -eu

# cd to the repo root regardless of where the script is invoked from
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC="$ROOT/present"
DST="$ROOT/public/presentation"

if [ ! -d "$SRC" ]; then
  echo "[sync-presentation] no present/ source found at $SRC -- nothing to mirror." >&2
  exit 0
fi

rm -rf "$DST"
mkdir -p "$DST"
# `cp -r SRC/. DST/` copies the contents of SRC into DST (note the /.).
cp -r "$SRC/." "$DST/"
echo "[sync-presentation] mirrored $SRC -> $DST" >&2
