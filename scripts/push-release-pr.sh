#!/usr/bin/env bash
# Push release/oman-ui-ops and open a PR into main.
# Requires: gh auth login (or a working git credential / SSH key for GitHub).
set -euo pipefail
cd "$(dirname "$0")/.."

BRANCH="${1:-release/oman-ui-ops}"
git checkout "$BRANCH"
git push -u origin "$BRANCH"

gh pr create --title "Ship Oman UI, shadcn backoffice, and deploy ops" --body "$(cat <<'EOF'
## Summary
- Field UI Oman refresh (teal/safety tokens, salesman/loader/login, mobile TopNav)
- Backoffice shadcn wave + manager/finance/admin chrome, i18n, loading/error shells
- Production hardening, Playwright suites, CI e2e with Postgres, health/backup scripts

## Test plan
- [ ] CI verify green
- [ ] CI e2e green
- [ ] docker compose web healthy
- [ ] `APP_ORIGIN=… ./scripts/health-smoke.sh`
- [ ] Live login (salesman + loader)
- [ ] Production CSP has no `unsafe-eval`

EOF
)" || gh pr view --web
