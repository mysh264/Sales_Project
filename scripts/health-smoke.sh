#!/usr/bin/env bash
# Smoke-check the public health endpoint. Intended for cron or post-deploy.
# Usage: APP_ORIGIN=https://sales.example.com ./scripts/health-smoke.sh
set -euo pipefail

ORIGIN="${APP_ORIGIN:-}"
if [[ -z "$ORIGIN" ]]; then
  echo "health-smoke: APP_ORIGIN is required" >&2
  exit 2
fi

URL="${ORIGIN%/}/api/health"
RESP="$(curl -fsS --max-time 15 "$URL" || true)"
if [[ -z "$RESP" ]]; then
  echo "health-smoke: no response from $URL" >&2
  exit 1
fi

echo "$RESP"
if echo "$RESP" | grep -q '"status":"ok"'; then
  echo "health-smoke: ok"
  exit 0
fi

echo "health-smoke: unhealthy response" >&2
exit 1
