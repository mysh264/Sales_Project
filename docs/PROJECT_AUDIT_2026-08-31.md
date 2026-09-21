# Full Project Audit — 2026-08-31, updated 2026-09-01

## Executive assessment

The repository is a coherent, server-rendered branch ERP rather than a loose collection of dashboards. Its strongest qualities are a centralized permission vocabulary, explicit branch/invoice scope helpers, transactional sales/reconciliation flows, a detailed audit trail, a production-oriented Compose topology, and a useful dev-only impersonation facility.

The audit also found defects at important trust boundaries: master-tester permission inheritance, sensitive values copied into audit JSON, a healthcheck that never reached the database, invalid PostgreSQL lock SQL, stale/concurrent debt and reconciliation writes, accounting classifications/rounding, destructive test seeding, and several UI statements that disagreed with persisted behavior. Those confirmed defects were corrected and covered by regression tests.

This is now a strong development/test system, but it is **not yet a complete production accounting platform**. The largest unresolved design decision is multi-currency customer accounting: invoice and price records have currencies, while `Customer.creditLimit` and `creditBalance` are single unlabelled amounts. A production rollout should either constrain a customer/branch to one accounting currency or migrate credit/debt limits to currency-scoped balances.

## Architecture understood

### Runtime

- Next.js 15.5 App Router with React 19 and server-rendered pages.
- Prisma 7 with the PostgreSQL driver adapter against PostgreSQL 16.
- Tailwind/CSS design-system components under `components/ui/` and `app/globals.css`.
- Signed HTTP-only session cookie containing the user id, role, permissions, session version, and optional impersonator id.
- Docker Compose services for PostgreSQL, Next.js, daily retention, and daily `pg_dump` backups.
- Standalone Next output; container startup runs migrations, ensures the minimum company/admin bootstrap, then starts the server.

### Request flow

1. `middleware.ts` validates the JWT and maps protected path prefixes to permissions. Unknown protected role paths fail closed.
2. A role layout calls `getCurrentUser()`, which reloads the active user and checks `sessionVersion` against PostgreSQL.
3. A Server Component queries scoped view data.
4. A Server Action repeats permission and branch/record checks, validates `FormData`, runs a transaction/advisory lock where needed, and writes an audit record.
5. The action revalidates affected pages and redirects or returns a result.

### Role model

| Role | Operational surface | Responsibility |
|---|---|---|
| ADMIN | `/admin`, `/admin-console` | Global configuration, branches, products, users, roles, audit, optional cylinder serials. |
| GENERAL_MANAGER | `/general-manager` | Cross-branch oversight and delegated user/report administration. |
| MANAGER | `/manager` | Branch pricing, sales/finance oversight, debt collection/write-off, discrepancy approval. |
| LOADER | `/loader` | Morning route load and evening return/reconciliation. |
| SALESMAN | `/salesman` | Customer selection, invoice capture, payment evidence, debt collection, invoice history. |
| TESTER | `/tester` | Dev/test-only impersonation of canonical test identities. |

Custom `Role` rows provide permission profiles, while the built-in `UserRole` continues to define the account family and home route. Internal tester impersonation is intentionally excluded from normal role assignment.

## Data model understood

### Organization and identity

- `Company` owns `Branch` records.
- `User` has a built-in role, optional custom role profile, optional branch, login/MFA/lockout state, and monotonic `sessionVersion`.
- `Role.permissions` stores normalized permission strings.
- `AuditLog` stores actor, target, before/after JSON, request evidence, and now a separate effective user during impersonation.

### Sales and customer accounting

- `Customer` belongs to a branch and owns invoices/debts plus a tokenized public statement link.
- `Product` is the gas/product master; `ProductPriceRule` supplies time-windowed branch prices and currency.
- `Invoice` owns line items and payments and separates paid, outstanding debt, written-off settlement, customer credit, and debt collected during a new sale.
- `CustomerDebt` is the per-invoice receivable; `DebtPayment` is the collection/write-off ledger.
- Money persists at three decimal places; tax rates persist at four.

### Physical cylinder operations

- `DailyReconciliation` is unique by salesman/business date and has per-product morning/evening quantities and variances.
- `InventoryBalance` stores branch/product full and empty counts.
- `CylinderMovement` is the count-based movement ledger tying invoice and reconciliation events to inventory.
- Optional `Cylinder`/`CylinderEvent` models add serial-level tracking without replacing the count-based workflow.

## Core workflows understood

### Salesman invoice

The salesman must have an open morning route. The form chooses an existing/new branch customer, validates branch/currency price rules, validates quantities against route availability, computes rounded totals/VAT/payments/credit/debt, stores uploaded payment evidence privately, creates invoice/items/payments/debt/movements, optionally applies same-currency old debt under locks, and audits the result.

### Loader reconciliation

Morning load decrements branch stock and establishes per-product route quantities. Evening return reconciles those quantities against invoice movement totals. Exact reconciliation posts inventory immediately; discrepancies remain pending until a manager supplies an approval reason. Route mutations are serialized, and morning loads cannot be rewritten after sales exist.

### Manager finance

Managers maintain branch price windows, collect debts with attachment/reference evidence, write off unrecoverable balances, review all sales, and approve inventory discrepancies. Collection uses the payment ledger; write-off now settles a separate invoice bucket rather than pretending cash was received.

### Master tester

The tester receives no normal business permissions. When enabled, it can switch only into active `isTestUser=true` accounts. Every switch is audited. Business actions taken while impersonating now record the tester as real actor and the target as effective user. Stop impersonation restores tester identity; Logout deletes the session and returns to login.

## Confirmed defects fixed

### Critical / high

1. **ADMIN inherited `Testers_Impersonate` through generic administrator shortcuts.** `hasPermission`, `hasAnyPermission`, route gating, role assignment, and the role editor now preserve the tester-only trust boundary (`lib/permissions.ts`).
2. **Audit snapshots copied full User rows, including password hashes, MFA secrets/recovery hashes, and statement token hashes.** Recursive centralized redaction protects all future writes, and a migration recursively redacts historical JSON (`lib/audit.ts`; migration `20260831010000_redact_audit_secrets`).
3. **Impersonated actions were attributed to the target account.** Audit rows now store real and effective identities separately, and both UI and CSV expose “Acting as” (`lib/audit.ts`; `app/admin/audit-logs/`).
4. **Docker health never reached PostgreSQL.** Middleware redirected `/api/health` to login, and `wget` followed the redirect. Health is now a public exception that executes the real DB query (`middleware.ts:50`).
5. **New price rules called nonexistent three-argument `pg_advisory_xact_lock`.** Create and edit now share a valid two-key lock and re-read mutable state after acquisition (`lib/price-rule.ts`; `app/actions/manager.ts`).
6. **Debt collection read mutable debt before locking; write-off had no matching lock.** Both now lock first and then load (`lib/debt-lock.ts`; `app/actions/manager.ts`).
7. **Sales-side debt collection could record an unapplied amount, overcollect, cross currencies, and omit the source Payment row.** It validates same-currency outstanding debt, locks/reloads each debt, rejects races/remainders, and updates Invoice, CustomerDebt, DebtPayment, and Payment together (`app/actions/sales.ts`).
8. **Morning loads could be rewritten after sales, and simultaneous evening returns could post inventory twice.** State gates and advisory locks now enforce one legal transition (`lib/reconciliation.ts`; `app/actions/loader.ts`).
9. **Independent database rounding could violate `paid + debt = total`.** Money is quantized before dependent arithmetic. The invariant is now exact and includes a distinct written-off amount (`lib/money.ts`; `app/actions/sales.ts`).
10. **Write-off increased `paidAmount`, reporting bad debt as cash received.** `Invoice.writtenOffAmount` and a migration preserve settlement without inflating payment (`app/actions/manager.ts`; migration `20260831011000_invoice_write_off_amount`).

### Security / reliability

11. Exported `listImpersonationTargets()` had no action-level caller check. Exported tester actions now enforce the feature/active/permission gate.
12. MFA recovery-code regeneration required only an unlocked session. It now requires current-password step-up and revokes prior sessions.
13. Master-tester seed passwords had known defaults, and canonical-email collisions could convert human accounts into test users. Passwords are explicit and the seed refuses any non-test collision.
14. Bootstrap compared salted bcrypt hashes, so it rewrote the password every restart and failed to distinguish a real rotation. It now uses `bcrypt.compare`, targets the configured email, and increments `sessionVersion` only for a real password change.
15. Fresh startup created an admin but no Company, while branch creation required a Company. Bootstrap now creates only the missing company, without rerunning demo seed data.
16. Client-supplied hidden toggle state controlled user/product changes and audit verbs. Toggle state now comes from the database row.
17. Creating a user with a built-in role reset that role profile to hard-coded defaults. Existing role customizations are now preserved.
18. The cylinder event action used the branchless administrator as event branch. It loads and uses the selected cylinder’s branch and validates event/status values.
19. Maintenance could run retention before migrations, fail, and sleep for a day. It now waits for the migrated healthy web service.
20. The optional live integration suite treated legitimate `sessionVersion > 1` as corruption. It now validates ranges and passes against the live database.

### UI and reporting

21. Tester Logout was below all 11 targets. Audit and Logout are now in a sticky, immediately visible header.
22. Role permission checkboxes auto-saved each click and exposed internal tester/nonsensical impersonation controls. Editing now uses an explicit save and only assignable resources/actions.
23. The new-order page generated one serial for display and another for submission. One value now serves both.
24. A branch configured for 0% VAT was displayed/calculated as 5%, while a missing field could become 0%. Explicit zero and missing-value fallback are now distinct.
25. The payment preview said overpayment would be returned while the server stored it as customer credit. The UI now states the actual credit behavior.
26. “Revenue in period” and debt KPIs used only the latest 50 table rows. Full-period, per-currency aggregates are now separate from the 50-row display.
27. Per-currency debt collection omitted manager payments and the headline mixed currencies. The DebtPayment ledger is now the source; write-offs are excluded.
28. Shared input placeholder contrast was too light. The design token is now `slate-500` project-wide.
29. ESLint 9 emitted an obsolete `.eslintignore` warning. Ignores are now entirely in flat config.
30. Production `npm audit` reported vulnerable `deepmerge-ts` and PostCSS patch levels through Prisma/Next. Compatible npm overrides now resolve `deepmerge-ts@8.0.2` and `postcss@8.5.26`; Prisma generation and the full Next build pass on that tree.

### Second-pass audit fixes

31. **Cheque evidence was unreachable.** The sales action read `checkReceipt`, but the new-invoice form had no matching file input. Cheque and transfer evidence are now both submit-capable.
32. **Delegated role managers could create or update profiles containing permissions they did not possess.** Both role mutations now use the same no-escalation gate as user assignment.
33. **The “Global Sales” toggle also granted legacy global write access.** Read visibility and cross-branch mutation are now separate concepts; the UI changes only `allowGlobalSalesView`, write scope ignores that flag, and migration `20260831013000_separate_global_sales_visibility` clears legacy combined grants.
34. **Tester trust could be recreated or used after revocation.** Routine user management cannot assign `TESTER`; disabled test accounts cannot log in when the feature is off; impersonation requires the dedicated active `TESTER + isTestUser` identity and a current `sessionVersion`.
35. **Concurrent failed logins and recovery-code submissions could bypass single-use/lockout guarantees.** Failed attempts use one atomic SQL increment, and recovery codes use compare-and-swap on both the stored code set and session version.
36. **First-time MFA enrolment required no password step-up.** Beginning setup now verifies the current password, matching re-enrolment and disable/regeneration protections.
37. **Branch-scoped loaders could fetch payment evidence without Sales/Finance read permission.** Attachment serving now requires both invoice scope and an explicit read capability.
38. **CSV exports allowed spreadsheet formula injection.** The shared CSV encoder neutralizes formula-leading user strings, protecting all exports.
39. **Evening authorization followed a salesman’s current branch instead of the reconciliation’s historical branch.** The action gates against `DailyReconciliation.branchId`; historical empty returns are accepted independently from morning full counts.
40. **Manual inventory adjustments could overwrite concurrent loader movements.** Adjustment now locks the actual inventory row and applies atomic increments.
41. **Duplicate invoice rows could individually pass the route-stock limit while exceeding it in aggregate.** Delivered quantities are summed per product at the server stock gate.
42. **Cylinder registration could commit the cylinder without its initial event or audit evidence.** Upsert, event, and both audit records now share one transaction.
43. **PAID/WRITTEN_OFF filters also required `balance > 0`, making terminal rows impossible to display.** A shared debt-status query helper preserves the balance guard only for active debt.
44. **Currency selection and displayed price rules were disconnected.** Every current currency band is sent to the client; switching OMR/USD/AED reprices visible rows, while the server remains the authoritative validator.
45. **Audit CSV exported only the first action in a visible multi-action group.** Page and export route now resolve the same complete action-group mapping.
46. **A Server Component owned a browser `window.print()` handler.** The statement page now delegates printing to the existing client component.
47. **All 48 presentation gallery screenshots were Cloudflare Error 1033 pages.** A deterministic role-aware Playwright harness regenerated all 32 desktop and 16 mobile assets; OCR found 0 remaining error pages, and live/source hashes match.
48. **Presentation navigation and claims were stale/inaccessible.** Inactive slides are hidden/inert, dots expose `aria-current`, controls have explicit labels, and displayed user/test/route totals match verified state.

## Strengths retained

- Protected routes default-deny, and route-map coverage is tested against every protected `page.tsx`.
- Business actions generally repeat authorization rather than trusting middleware alone.
- Branch and invoice access are centralized in reusable helpers.
- Session invalidation is monotonic and checked against the database.
- Uploads are stored outside `public/` and are served only after invoice scope plus Sales/Finance read checks.
- Transactional invoice/reconciliation flows have explicit idempotency and/or locking mechanisms.
- Audit records preserve IP/user agent and structured before/after differences.
- Compose uses named volumes and one external `docker_shared` network; no host-hardcoded project paths or systemd wrappers were added.
- The presentation has a canonical source and a deterministic build-time public mirror.

## Remaining risks and limitations

### P0 before production accounting use

1. **Choose a multi-currency credit model.** Invoice/debt/price records have currency, but customer credit balance and credit limit do not. Current fixes prevent cross-currency debt application and avoid report aggregation, but customer credit itself remains ambiguous. Recommended choices:
   - constrain each branch/customer to one accounting currency and remove free invoice currency override; or
   - add a `CustomerCurrencyBalance(customerId, currency, creditLimit, creditBalance)` model and migrate all credit operations.
2. **Resolve user-mutation atomicity.** Several user actions deliberately write the User row and audit record sequentially because of an earlier PrismaPg transaction concern (`app/actions/users.ts`). A failure can leave a mutation without audit evidence. Reproduce the adapter issue on current Prisma, then restore a transaction or use an outbox/mandatory audit write.
3. **Define write-off approval policy.** The mechanics and accounting bucket are now correct, but one manager can write off a full debt. Production may require a threshold, second approver, or ADMIN/GM-only authority.

### P1 reliability/security

4. Public statement tokens are stored plaintext. Hash-at-rest tokens would reduce the impact of a database read leak.
5. Upload validation checks declared type/extension and size, not file signatures or malware. Add magic-byte validation and, if required, antivirus scanning.
6. Backups live in one local Docker volume. Add encrypted off-host copies, monitoring, and scheduled restore drills.
7. Audit export stops at 5,000 records without an explicit truncation warning. Use streamed/keyset export or display the cap.
8. The 50-row sales table has correct KPIs now but still has no pagination.
9. Retention and backup workers have no first-class health/status dashboard or success-age alert.
10. Optional serial-cylinder state and count-based inventory can diverge because serial events are not required for invoice/reconciliation completion.
11. Role-policy review is still required before production: current built-in Manager/Loader defaults intentionally retain broad product/inventory update permissions. Narrow them only after deciding whether those roles must perform those operations.
12. General-manager route aliases reuse several admin implementations with hard-coded admin links; use shared pages with role-specific base paths for a fully consistent workspace.
13. Database backup does not include the uploads volume. Add encrypted off-host database and attachment backup, age monitoring, and a restore drill covering both.

### P2 UI/test depth

14. Add root/role `loading.tsx`, `error.tsx`, and empty/error states for DB-heavy screens.
15. Replace yesterday-prefilled morning-load quantities with explicit copy/confirm behavior, and add strict impossible-date validation to `OmanDateInput`.
16. Add attachment review links, mobile tender breakdowns, permission-gated reconciliation buttons, and dialog/combobox/live-region accessibility patterns.
17. Improve zero-data chart narration and ensure zero values render as zero-width bars.
18. Add Playwright mutation flows for invoice submission, debt collection, reconciliation, impersonation stop/logout, and audit export.
19. Add action-level integration tests for branch denial, concurrent submissions, file rejection, and bootstrap on disposable PostgreSQL.
20. Add a root README that points to `PROJECT_MAP.md`, this audit, `DEPLOY.md`, and the operational matrix.

## Verification record

- Baseline before audit: **24/24** unit tests, typecheck, lint, and production build passed.
- After both audit passes: **100/100** unit/regression tests passed.
- Live PostgreSQL integration: **5/5** checks passed.
- Prisma schema generation passed.
- Production dependency audit: **0 known vulnerabilities** (`npm audit --omit=dev`).
- All four audit SQL migrations were validated against PostgreSQL 16 before deployment.
- `git diff --check`, Compose config validation, TypeScript, ESLint, and the production build all passed.
- Deterministic route gate: **474/474** cases passed.
- Deployment applied all 17 migrations, left **0 unredacted sensitive audit values** and **0 read-visibility users with legacy global-write scope**, returned real database health JSON, and started with clean web/maintenance logs.
- Live presentation verification checked 48 regenerated screenshots with **0 Error 1033** detections and matched the served new-order screenshot hash to the canonical source.
- A validated pre-second-pass custom-format backup is stored at `/tmp/sales_pre_second_pass_20260901.dump`.
- Final `sales_nextjs` and `sales_project-web:latest` resolve to healthy image `sha256:9f564349d790d0703d78b2b28078440287bab5b839a728defd39126749d51395`.

See `PROJECT_MAP.md` for the complete 319-file map and `project_history.md` for the append-only maintenance ledger.
