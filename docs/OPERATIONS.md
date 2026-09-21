# Production Operations

## Required configuration

Copy `.env.example` into the deployment secret store. Use unique database, JWT,
admin-seed, and demo passwords. Keep demo users disabled in production.
Set `APP_ORIGIN` to the exact public HTTPS origin. Compose deliberately refuses
to start when its database URL, database password, JWT secret, or origin is absent.

## Deployment

The container runs `prisma migrate deploy` before starting Next.js. Back up the
database before deploying a schema change. The readiness endpoint is
`GET /api/health`; it returns HTTP 503 when PostgreSQL is unavailable.

The built-in accounts are Admin, General Manager, Manager, Loader, and Salesman.
The Manager account combines the former manager and accounting account benefits.
The consolidation migration converts existing accounting accounts to Manager and
revokes their existing sessions.

## Backup and restore

Run `scripts/backup-postgres.sh` from a host with PostgreSQL client tools. Store
the resulting custom-format dump outside the application server.

Test restoration regularly:

```sh
createdb sales_restore_test
pg_restore --clean --if-exists --no-owner --dbname=sales_restore_test backup.dump
```

After restoration, run `prisma migrate status`, the integration tests, and a
manual login/invoice/reconciliation smoke test.

The Compose `backup` service creates a custom-format PostgreSQL dump every day in
the `backup_data` volume and deletes dumps older than `BACKUP_RETENTION_DAYS`.
Copy backups to independent storage; a Docker volume alone is not disaster recovery.

## Retention and uploads

The `maintenance` service runs the retention job daily. It removes audit records
older than `AUDIT_RETENTION_DAYS` and orphaned private uploads after 24 hours.
Payment attachments are served only through the authenticated attachment route;
do not expose the upload volume through a static web server.

## Account security

Users can enable authenticator MFA from `/profile/security`. Password resets revoke
all existing sessions, clear login lockouts, and require a minimum of 12 characters.
Five failed password or MFA attempts lock the account for 15 minutes.

## Monitoring

Monitor container restarts, `/api/health`, HTTP 5xx responses, failed logins,
`SECURITY_BREACH` audit entries, inventory adjustments, reconciliation failures,
database storage, and backup age. Forward structured container output to the
deployment logging platform and connect an error tracker before public rollout.

### Health smoke (cron-friendly)

```sh
# every 5 minutes
APP_ORIGIN=https://sales.mahmoudbox.com /opt/Sales_Project/scripts/health-smoke.sh
```

Expect HTTP 200 and JSON `"status":"ok"`. Non-zero exit means alert.

### Post-deploy smoke checklist

1. `docker compose ps` — `web` healthy
2. `APP_ORIGIN=… ./scripts/health-smoke.sh`
3. Browser login as salesman / loader
4. Confirm response CSP on HTTPS has no `unsafe-eval`

### Off-host backup reminder

Compose `backup` writes dumps into the `backup_data` volume. That is not DR.

```sh
# After mounting or syncing dumps to an off-host path:
BACKUP_DIR=/mnt/offhost/sales-backups MAX_AGE_HOURS=36 \
  ./scripts/offhost-backup-reminder.sh
```

Copy dumps with rsync/SCP on a schedule (daily). Restore drills remain mandatory.

### CI secrets for E2E

GitHub Actions job `e2e` seeds demo users. Optionally set repository secrets:

| Secret | Purpose |
| --- | --- |
| `SEED_ADMIN_PASSWORD` | Admin seed (≥12 chars) |
| `SEED_DEMO_PASSWORD` | Demo role passwords for Playwright |

Fallbacks exist for CI only; never reuse them in production `.env`.
