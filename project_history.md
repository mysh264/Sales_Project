# Project History

Append-only maintenance and verification ledger. Add new dated entries below; do not rewrite prior entries.

## 2026-08-31 — Full architecture, security, accounting, operations, and UI audit

### Scope understood

- Mapped the Next.js App Router screens, role layouts, Server Actions, middleware/session flow, shared UI system, Prisma schema, migrations/seeds, Docker topology, operations scripts, and test harnesses.
- Documented all repository files in `PROJECT_MAP.md` and the full findings/priorities in `docs/PROJECT_AUDIT_2026-08-31.md`.
- Established a baseline of 24 passing automated tests before the audit.

### Security and audit fixes

- Preserved `Testers_Impersonate` as a tester-only internal capability: ADMIN no longer inherits it, cannot enter `/tester`, cannot delegate it through a custom role, and the role editor no longer exposes internal tester/impersonation controls.
- Added action-level authorization to exported master-tester target/audit functions and required an active authorized tester when restoring identity.
- Added recursive audit redaction for password, secret, token, recovery-code, API-key, private-key, and credential fields.
- Added and applied a migration that recursively redacted historical sensitive audit values while preserving field names and forensic structure.
- Added `AuditLog.effectiveUserId`; impersonated business actions now record the real master tester as actor and the test account as effective user. Updated UI and CSV export to show both.
- Required current-password step-up before regenerating MFA recovery codes.
- Removed built-in tester passwords and made the test seed refuse collisions with non-test accounts.
- Fixed bootstrap password comparison to use `bcrypt.compare`; real password rotations increment `sessionVersion`, unchanged passwords no longer churn hashes.

### Financial and concurrency fixes

- Replaced invalid three-argument price-rule advisory-lock SQL with a collision-safe two-key lock and applied it to both create and edit paths.
- Moved debt reads after lock acquisition and serialized write-off with collection.
- Made sales debt collection same-currency, bounded by outstanding debt, race-safe, and consistent across Invoice, Payment, CustomerDebt, and DebtPayment ledgers.
- Rounded three-decimal money and four-decimal tax rates before dependent arithmetic; invoice balance validation is now exact at storage scale.
- Added a separate `Invoice.writtenOffAmount`, migrated existing write-off ledgers, and stopped reporting write-off as customer payment.
- Based per-currency debt reporting on DebtPayment, excluded write-offs from collections, included manager-entered payments, and stopped the headline from mixing currencies.
- Replaced latest-50 KPI calculations with full-period, per-currency aggregates while retaining the 50-row display.

### Inventory and reconciliation fixes

- Prevented morning loads from being rewritten after invoices exist.
- Added morning/evening advisory locks so duplicate concurrent submissions cannot double-post inventory.
- Rejected fractional/invalid cylinder quantities instead of silently truncating with `parseInt`.
- Made cylinder events inherit the selected cylinder’s branch instead of the branchless administrator.

### User/role/data fixes

- Derived user/product/global-access toggles from authoritative database state instead of hidden client state.
- Preserved customized built-in role profiles when creating users.
- Ensured fresh bootstrap creates the required Company before administrators create branches.
- Kept user/session test-state checks valid for operational `sessionVersion > 1` values.

### UI fixes

- Moved tester Audit and Logout controls into a sticky visible header.
- Removed role-permission checkbox auto-submit; changes now wait for explicit Save.
- Generated one invoice serial for both display and submission.
- Preserved an explicit branch 0% VAT value and distinguished it from a missing form value.
- Changed overpayment copy to state that value is added to customer credit rather than returned as change.
- Increased shared placeholder contrast from `slate-400` to `slate-500`.
- Removed the obsolete ESLint 9 `.eslintignore` warning.

### Operations and dependency fixes

- Exempted `/api/health` from session middleware so Compose and external probes execute the real database query.
- Made retention wait for the migrated, healthy web service before its first run.
- Ensured startup creates only missing Company/admin bootstrap data and does not rerun destructive demo seed data.
- Added compatible dependency overrides for `deepmerge-ts@8.0.2` and `postcss@8.5.26`; retained all pre-existing security overrides.
- Repaired the deterministic route-gate harness by removing its missing `/tmp` loader and making expectations fail closed.
- Took a pre-migration custom-format backup at `/tmp/sales_pre_full_audit_20260831.dump` and validated its archive table.

### Verification

- `git diff --check`: passed.
- `docker compose --project-name sales_project config --quiet`: passed.
- TypeScript: passed.
- ESLint with zero warnings: passed.
- Unit/regression tests: **68/68 passed** (baseline 24/24).
- Deterministic route matrix: **474/474 passed**.
- Live PostgreSQL integration: **5/5 passed**.
- Production Next build: passed on Next.js 15.5.24.
- Prisma client generation: passed on Prisma 7.10.0.
- `npm audit --omit=dev`: **0 known vulnerabilities**.
- Three new SQL migrations were executed successfully against PostgreSQL 16; migration count is 16 with no pending migration.
- Historical audit verification: **0 sensitive values remain unredacted**.
- Financial invariant: 1 invoice checked, 0 violations.
- Live public checks: `/api/health` 200 with `database=ok`, `/login` 200, presentation 200, unauthenticated `/tester` redirects to `/login`.
- Final `sales_nextjs` image/container ID matches `sha256:59067205427d45f93e5dd7cdcbefdb0cc7e01a96ece76d06474996e413eedf16`; health is `healthy`.
- Live compiled artifact contains Audit “Acting as”, sticky tester logout, customer-credit copy, audit CSV effective-user columns, written-off accounting, same-currency debt validation, and the patched dependency versions.
- Startup/maintenance logs are clean; second bootstrap reports `admin_exists`, proving idempotence.
- Existing backup-volume archive and the new pre-migration backup both validate with `pg_restore --list`.

### Ideas for later

1. Decide and implement the production multi-currency customer-credit model (single branch currency vs. per-currency balance table).
2. Reproduce the historical PrismaPg user-action transaction issue and make User + Audit writes atomic.
3. Add write-off thresholds and optional second approval.
4. Hash public statement tokens at rest.
5. Add magic-byte/malware scanning for payment evidence.
6. Add encrypted off-host backups, backup-age monitoring, and scheduled restore drills.
7. Add pagination to All Sales and streamed/keyset audit export beyond 5,000 rows.
8. Add root/role loading, error, and richer zero-data states.
9. Add disposable-Postgres action integration and Playwright flows for every role, impersonation, invoice, debt, and reconciliation path.
10. Decide whether serial-cylinder events must become mandatory so serial and count ledgers cannot diverge.

## 2026-09-01 — Second-pass security, concurrency, form-contract, and presentation audit

### Security and authorization

- Enforced the role-profile no-escalation gate in both create and update actions.
- Split Global Sales read visibility from legacy cross-branch write scope and migrated combined non-global grants away.
- Required the dedicated active `TESTER + isTestUser` identity, current session version, and enabled feature for test-account login/impersonation; routine user management cannot assign TESTER.
- Made failed-login increments atomic and recovery-code use compare-and-swap single-use under concurrency.
- Required current-password step-up before first-time MFA setup.
- Required Sales or Finance read permission in addition to invoice scope before serving payment evidence.
- Neutralized spreadsheet formulas in the shared CSV encoder.

### Inventory, sales, and data integrity

- Added the missing cheque-receipt upload field consumed by invoice creation.
- Authorized evening reconciliation against the stored historical branch rather than the salesman’s current branch.
- Accepted legitimate historical empty-cylinder returns independently from morning full counts.
- Changed manual inventory adjustment to row-lock the balance and apply atomic deltas.
- Aggregated duplicate invoice product rows before the route-stock limit.
- Made cylinder registration, initial event, and audit evidence one transaction.
- Fixed PAID/WRITTEN_OFF debt filters so terminal zero-balance rows are reachable.
- Connected the invoice currency selector to all current per-currency price bands and repriced visible rows on changes.
- Preserved full action groups in audit CSV and moved statement printing behind a client component.

### Presentation and reproducibility

- Confirmed all 48 previous desktop/mobile gallery images were Cloudflare Error 1033 pages.
- Added `scripts/presentation-routes.json` and `scripts/capture-presentation.mjs` for deterministic role-aware Playwright capture using short-lived sessions without printing credentials/tokens.
- Regenerated 32 desktop and 16 mobile screenshots from the healthy final deployment; OCR found 0 Error 1033 pages.
- Added explicit navigation labels, `aria-current`, `aria-hidden`, and `inert` semantics to the deck.
- Updated live user, route-gate, regression-test, currency, and financial-invariant claims.

### Verification

- `git diff --check`, Compose config, Prisma validate/generate, TypeScript, and zero-warning ESLint passed.
- Unit/regression suite: **100/100 passed**.
- Deterministic route gate: **474/474 passed**.
- Live PostgreSQL integration: **5/5 passed**.
- Financial invariant: 1 invoice checked, 0 violations.
- Production Next.js build passed; `npm audit --omit=dev` reports **0 vulnerabilities**.
- All **17 migrations** are applied with no pending migration and no remaining Global Sales read/write overlap for non-global roles.
- Public health/login/presentation checks returned 200; unauthenticated tester access redirects to login.
- Canonical and served presentation screenshot SHA-256 hashes match; 48/48 images passed the Error 1033 OCR scan.
- Pre-second-pass database backup `/tmp/sales_pre_second_pass_20260901.dump` and the backup-volume archive both validate with `pg_restore --list`.
- Final web image/container is healthy at `sha256:9f564349d790d0703d78b2b28078440287bab5b839a728defd39126749d51395`.

### Ideas for later

1. Decide between branch-single-currency credit or a per-currency customer-balance table before production accounting use.
2. Confirm whether Manager/Loader should retain broad default product/inventory mutation rights, then narrow permissions and UI together if not.
3. Make User mutation + Audit evidence atomic after reproducing the historical PrismaPg adapter concern.
4. Add encrypted off-host backups for both PostgreSQL and `storage/uploads`, plus age monitoring and restore drills.
5. Replace general-manager admin-route aliases with shared pages that accept a role-specific base path.
6. Replace yesterday-prefilled morning loads with explicit copy/confirmation and enforce impossible-date validation.
7. Add attachment review links, mobile tender breakdown, permission-aware action controls, and dialog/combobox/live-region accessibility.
8. Add mutation-level Playwright flows and disposable-PostgreSQL concurrency tests.
