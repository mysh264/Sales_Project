# Sales & Cylinder Tracking — Project Map

_Last regenerated: 2026-09-01 (+04). Files mapped: 319._

## System in one view

This is a **Next.js 15 / React 19 App Router ERP** backed by **PostgreSQL 16 through Prisma 7**. It manages branch-scoped gas-cylinder inventory, daily route reconciliation, customer sales/debt, role/profile permissions, audit evidence, payment attachments, and a development-only master-tester facility.

```text
Browser / mobile
  -> Next.js middleware (signed JWT + default-deny route/permission map)
  -> live user/sessionVersion check
  -> Server Component page
  -> Server Action / route handler
     -> permission + branch/invoice scope
     -> validation + transaction/row or advisory lock
     -> Prisma models + redacted audit log
  -> revalidation / redirect

Docker Compose
  -> PostgreSQL (persistent volume)
  -> Next.js web (migrate -> bootstrap company/admin -> serve)
  -> retention worker (waits for healthy migrated web)
  -> pg_dump backup worker
```

## Roles and operating surfaces

| Role | Home | Main responsibility |
|---|---|---|
| `ADMIN` | `/admin` | Global setup, branches/products/users/roles, audit, cylinder registry. |
| `GENERAL_MANAGER` | `/general-manager` | Cross-branch oversight, users, reports, and finance visibility. |
| `MANAGER` | `/manager` | Branch sales/finance oversight, price rules, debt collection/write-off, discrepancies. |
| `LOADER` | `/loader` | Morning loads, evening returns, and physical reconciliation. |
| `SALESMAN` | `/salesman` | Customer invoices, payment evidence, debt collection, and history. |
| `TESTER` | `/tester` | Dev/test-only switching into canonical test users; no normal business permission. |

## Core data relationships

- `Company -> Branch -> User / Customer / InventoryBalance / reconciliation / invoice` defines organizational scope.
- `Product + ProductPriceRule` define gases and time-windowed branch/currency pricing.
- `Invoice -> InvoiceItem / Payment / CustomerDebt`; `DebtPayment` is the collection/write-off ledger.
- `Invoice.paidAmount`, `debtAmount`, and `writtenOffAmount` are separate settlement buckets.
- `DailyReconciliation -> items -> CylinderMovement` connects route counts to invoice activity.
- Optional `Cylinder`/`CylinderEvent` records serial state while count-based inventory remains authoritative.
- `Role.permissions` supplies custom profiles; `User.role` determines account family and home.
- `AuditLog` stores real actor and optional effective impersonated user separately.

## Request and trust boundaries

1. Middleware rejects unmapped protected paths by default; `/api/health` is deliberately public for DB probes.
2. `getCurrentUser()` rechecks active state and `sessionVersion`, so revocation is immediate.
3. Server Actions repeat permission and record/branch checks; hidden client state is not trusted.
4. Contention-sensitive finance/inventory flows use PostgreSQL row/advisory locks and atomic updates.
5. Private payment files require both invoice scope and Sales/Finance read permission.
6. Global Sales is read visibility only; it does not grant cross-branch mutation.
7. Master tester is feature-flagged, dedicated-role/test-user gated, and cannot target real users.

## Per-file map

| File | Purpose | Domain/spec area |
|---|---|---|
| `.dockerignore` | Project support file: .dockerignore. | Repository / support |
| `.env.example` | Project support file: .env.example. | Repository / support |
| `.github/workflows/ci.yml` | GitHub automation: ci.yml. | Operations / CI |
| `.gitignore` | Project support file: .gitignore. | Repository / support |
| `CONTRIBUTING.md` | Project documentation: CONTRIBUTING.md. | Repository / documentation |
| `DEPLOY.md` | Deployment/runtime definition: DEPLOY.md. | Operations / deployment |
| `Dockerfile` | Deployment/runtime definition: Dockerfile. | Operations / deployment |
| `PROJECT_MAP.md` | This per-file architecture and ownership map. | Repository / documentation |
| `app/actions/auth.ts` | Server Actions for auth: validation, authorization, mutation, audit, and revalidation. | Application / server actions |
| `app/actions/branches.ts` | Server Actions for branches: validation, authorization, mutation, audit, and revalidation. | Application / server actions |
| `app/actions/customer-search.ts` | Server Actions for customer-search: validation, authorization, mutation, audit, and revalidation. | Application / server actions |
| `app/actions/finance.ts` | Server Actions for finance: validation, authorization, mutation, audit, and revalidation. | Application / server actions |
| `app/actions/impersonate.ts` | Server Actions for impersonate: validation, authorization, mutation, audit, and revalidation. | Application / server actions |
| `app/actions/inventory.ts` | Server Actions for inventory: validation, authorization, mutation, audit, and revalidation. | Application / server actions |
| `app/actions/loader.ts` | Server Actions for loader: validation, authorization, mutation, audit, and revalidation. | Application / server actions |
| `app/actions/manager.ts` | Server Actions for manager: validation, authorization, mutation, audit, and revalidation. | Application / server actions |
| `app/actions/products.ts` | Server Actions for products: validation, authorization, mutation, audit, and revalidation. | Application / server actions |
| `app/actions/roles.ts` | Server Actions for roles: validation, authorization, mutation, audit, and revalidation. | Application / server actions |
| `app/actions/sales.ts` | Server Actions for sales: validation, authorization, mutation, audit, and revalidation. | Application / server actions |
| `app/actions/security.ts` | Server Actions for security: validation, authorization, mutation, audit, and revalidation. | Application / server actions |
| `app/actions/statement.ts` | Server Actions for statement: validation, authorization, mutation, audit, and revalidation. | Application / server actions |
| `app/actions/users.ts` | Server Actions for users: validation, authorization, mutation, audit, and revalidation. | Application / server actions |
| `app/admin-console/page.tsx` | App Router screen for `/admin-console`. | Application / UI route |
| `app/admin/audit-logs/AuditLogTable.tsx` | Route-local React component: AuditLogTable. | Application / UI component |
| `app/admin/audit-logs/export/route.ts` | App Router HTTP/export handler. | Application / HTTP API |
| `app/admin/audit-logs/page.tsx` | App Router screen for `/admin/audit-logs`. | Application / UI route |
| `app/admin/branches/page.tsx` | App Router screen for `/admin/branches`. | Application / UI route |
| `app/admin/cylinders/CylinderForm.tsx` | Route-local React component: CylinderForm. | Application / UI component |
| `app/admin/cylinders/actions.ts` | Route-local server/helper module: actions. | Application / server |
| `app/admin/cylinders/page.tsx` | App Router screen for `/admin/cylinders`. | Application / UI route |
| `app/admin/finance/page.tsx` | App Router screen for `/admin/finance`. | Application / UI route |
| `app/admin/inventory/page.tsx` | App Router screen for `/admin/inventory`. | Application / UI route |
| `app/admin/layout.tsx` | Role/root layout, live-session gate, and navigation shell. | Application / UI shell |
| `app/admin/page.tsx` | App Router screen for `/admin`. | Application / UI route |
| `app/admin/products/page.tsx` | App Router screen for `/admin/products`. | Application / UI route |
| `app/admin/reconciliation/page.tsx` | App Router screen for `/admin/reconciliation`. | Application / UI route |
| `app/admin/roles/PermissionChecklist.tsx` | Route-local React component: PermissionChecklist. | Application / UI component |
| `app/admin/roles/create/page.tsx` | App Router screen for `/admin/roles/create`. | Application / UI route |
| `app/admin/roles/list/page.tsx` | App Router screen for `/admin/roles/list`. | Application / UI route |
| `app/admin/roles/page.tsx` | App Router screen for `/admin/roles`. | Application / UI route |
| `app/admin/sales/page.tsx` | App Router screen for `/admin/sales`. | Application / UI route |
| `app/admin/users/page.tsx` | App Router screen for `/admin/users`. | Application / UI route |
| `app/api/attachments/[...path]/route.ts` | Authenticated or operational HTTP route handler. | Application / HTTP API |
| `app/api/health/route.ts` | Authenticated or operational HTTP route handler. | Application / HTTP API |
| `app/finance/layout.tsx` | Role/root layout, live-session gate, and navigation shell. | Application / UI shell |
| `app/finance/reconciliation-overview/page.tsx` | App Router screen for `/finance/reconciliation-overview`. | Application / UI route |
| `app/finance/statements/[customerId]/export/route.ts` | App Router HTTP/export handler. | Application / HTTP API |
| `app/finance/statements/[customerId]/page.tsx` | App Router screen for `/finance/statements/[customerId]`. | Application / UI route |
| `app/finance/statements/export/route.ts` | App Router HTTP/export handler. | Application / HTTP API |
| `app/finance/statements/page.tsx` | App Router screen for `/finance/statements`. | Application / UI route |
| `app/general-manager/branches/page.tsx` | App Router screen for `/general-manager/branches`. | Application / UI route |
| `app/general-manager/finance/page.tsx` | App Router screen for `/general-manager/finance`. | Application / UI route |
| `app/general-manager/inventory/page.tsx` | App Router screen for `/general-manager/inventory`. | Application / UI route |
| `app/general-manager/layout.tsx` | Role/root layout, live-session gate, and navigation shell. | Application / UI shell |
| `app/general-manager/page.tsx` | App Router screen for `/general-manager`. | Application / UI route |
| `app/general-manager/products/page.tsx` | App Router screen for `/general-manager/products`. | Application / UI route |
| `app/general-manager/reconciliation/page.tsx` | App Router screen for `/general-manager/reconciliation`. | Application / UI route |
| `app/general-manager/roles/page.tsx` | App Router screen for `/general-manager/roles`. | Application / UI route |
| `app/general-manager/users/page.tsx` | App Router screen for `/general-manager/users`. | Application / UI route |
| `app/globals-print.css` | Global/style source: globals-print.css. | Application / UI styles |
| `app/globals.css` | Global/style source: globals.css. | Application / UI styles |
| `app/layout.tsx` | Role/root layout, live-session gate, and navigation shell. | Application / UI shell |
| `app/loader/SalesmanHandoffPicker.tsx` | Route-local React component: SalesmanHandoffPicker. | Application / UI component |
| `app/loader/layout.tsx` | Role/root layout, live-session gate, and navigation shell. | Application / UI shell |
| `app/loader/load/[salesmanId]/page.tsx` | App Router screen for `/loader/load/[salesmanId]`. | Application / UI route |
| `app/loader/page.tsx` | App Router screen for `/loader`. | Application / UI route |
| `app/loader/return/[salesmanId]/page.tsx` | App Router screen for `/loader/return/[salesmanId]`. | Application / UI route |
| `app/login/LoginForm.tsx` | Route-local React component: LoginForm. | Application / UI component |
| `app/login/page.tsx` | App Router screen for `/login`. | Application / UI route |
| `app/logistics/reconciliation/ReconciliationWorkbench.tsx` | Route-local React component: ReconciliationWorkbench. | Application / UI component |
| `app/logistics/reconciliation/page.tsx` | App Router screen for `/logistics/reconciliation`. | Application / UI route |
| `app/manager/all-sales/page.tsx` | App Router screen for `/manager/all-sales`. | Application / UI route |
| `app/manager/dashboard/page.tsx` | App Router screen for `/manager/dashboard`. | Application / UI route |
| `app/manager/inventory/page.tsx` | App Router screen for `/manager/inventory`. | Application / UI route |
| `app/manager/layout.tsx` | Role/root layout, live-session gate, and navigation shell. | Application / UI shell |
| `app/manager/page.tsx` | App Router screen for `/manager`. | Application / UI route |
| `app/manager/reconciliation/page.tsx` | App Router screen for `/manager/reconciliation`. | Application / UI route |
| `app/manager/settings/page.tsx` | App Router screen for `/manager/settings`. | Application / UI route |
| `app/manager/users/page.tsx` | App Router screen for `/manager/users`. | Application / UI route |
| `app/page.tsx` | App Router screen for `/`. | Application / UI route |
| `app/print/[invoiceId]/PrintButton.tsx` | Route-local React component: PrintButton. | Application / UI component |
| `app/print/[invoiceId]/page.tsx` | App Router screen for `/print/[invoiceId]`. | Application / UI route |
| `app/profile/security/RecoveryCodes.tsx` | Route-local React component: RecoveryCodes. | Application / UI component |
| `app/profile/security/page.tsx` | App Router screen for `/profile/security`. | Application / UI route |
| `app/s/[token]/page.tsx` | App Router screen for `/s/[token]`. | Application / UI route |
| `app/salesman/customer/[id]/page.tsx` | App Router screen for `/salesman/customer/[id]`. | Application / UI route |
| `app/salesman/history/page.tsx` | App Router screen for `/salesman/history`. | Application / UI route |
| `app/salesman/layout.tsx` | Role/root layout, live-session gate, and navigation shell. | Application / UI shell |
| `app/salesman/new-order/NewInvoiceForm.tsx` | Route-local React component: NewInvoiceForm. | Application / UI component |
| `app/salesman/new-order/page.tsx` | App Router screen for `/salesman/new-order`. | Application / UI route |
| `app/salesman/page.tsx` | App Router screen for `/salesman`. | Application / UI route |
| `app/salesman/receipt/[invoiceId]/ClearNewInvoiceStorage.tsx` | Route-local React component: ClearNewInvoiceStorage. | Application / UI component |
| `app/salesman/receipt/[invoiceId]/page.tsx` | App Router screen for `/salesman/receipt/[invoiceId]`. | Application / UI route |
| `app/tester/audit/page.tsx` | App Router screen for `/tester/audit`. | Application / UI route |
| `app/tester/page.tsx` | App Router screen for `/tester`. | Application / UI route |
| `components/AdminConsoleLink.tsx` | Shared React component: AdminConsoleLink. | Application / UI component |
| `components/BranchSelect.tsx` | Shared React component: BranchSelect. | Application / UI component |
| `components/EmployeeEditPanel.tsx` | Shared React component: EmployeeEditPanel. | Application / UI component |
| `components/ImpersonationBanner.tsx` | Shared React component: ImpersonationBanner. | Application / UI component |
| `components/OmanDateInput.tsx` | Shared React component: OmanDateInput. | Application / UI component |
| `components/PresentationLink.tsx` | Shared React component: PresentationLink. | Application / UI component |
| `components/StatementShareButton.tsx` | Shared React component: StatementShareButton. | Application / UI component |
| `components/ui/Badge.tsx` | Shared design-system component: Badge. | Application / UI system |
| `components/ui/Button.tsx` | Shared design-system component: Button. | Application / UI system |
| `components/ui/Card.tsx` | Shared design-system component: Card. | Application / UI system |
| `components/ui/Chart.tsx` | Shared design-system component: Chart. | Application / UI system |
| `components/ui/Field.tsx` | Shared design-system component: Field. | Application / UI system |
| `components/ui/PageHeader.tsx` | Shared design-system component: PageHeader. | Application / UI system |
| `components/ui/Stat.tsx` | Shared design-system component: Stat. | Application / UI system |
| `components/ui/TopNav.tsx` | Shared design-system component: TopNav. | Application / UI system |
| `docker-compose.yml` | Deployment/runtime definition: docker-compose.yml. | Operations / deployment |
| `docs/ERP_VERIFICATION_MATRIX.md` | Project documentation: ERP_VERIFICATION_MATRIX.md. | Repository / documentation |
| `docs/MASTER_TESTER_PLAN.md` | Project documentation: MASTER_TESTER_PLAN.md. | Repository / documentation |
| `docs/OPERATIONS.md` | Project documentation: OPERATIONS.md. | Repository / documentation |
| `docs/PROJECT_AUDIT_2026-08-31.md` | Project documentation: PROJECT_AUDIT_2026-08-31.md. | Repository / documentation |
| `docs/route-map.md` | Project documentation: route-map.md. | Repository / documentation |
| `eslint.config.mjs` | Project toolchain/configuration: eslint.config.mjs. | Repository / configuration |
| `lib/audit-action-groups.ts` | Shared domain/security helper: audit-action-groups. | Application / domain library |
| `lib/audit.ts` | Shared domain/security helper: audit. | Application / domain library |
| `lib/auth.ts` | Shared domain/security helper: auth. | Application / domain library |
| `lib/bootstrap-admin.ts` | Shared domain/security helper: bootstrap-admin. | Application / domain library |
| `lib/bootstrap-company.ts` | Shared domain/security helper: bootstrap-company. | Application / domain library |
| `lib/branch-scope.ts` | Shared domain/security helper: branch-scope. | Application / domain library |
| `lib/business-date.ts` | Shared domain/security helper: business-date. | Application / domain library |
| `lib/csv.ts` | Shared domain/security helper: csv. | Application / domain library |
| `lib/cylinders.ts` | Shared domain/security helper: cylinders. | Application / domain library |
| `lib/date-format.ts` | Shared domain/security helper: date-format. | Application / domain library |
| `lib/debt-collection.ts` | Shared domain/security helper: debt-collection. | Application / domain library |
| `lib/debt-filter.ts` | Shared domain/security helper: debt-filter. | Application / domain library |
| `lib/debt-lock.ts` | Shared domain/security helper: debt-lock. | Application / domain library |
| `lib/finance.ts` | Shared domain/security helper: finance. | Application / domain library |
| `lib/global-access.ts` | Shared domain/security helper: global-access. | Application / domain library |
| `lib/impersonate.ts` | Shared domain/security helper: impersonate. | Application / domain library |
| `lib/invoice-access.ts` | Shared domain/security helper: invoice-access. | Application / domain library |
| `lib/invoice-lines.ts` | Shared domain/security helper: invoice-lines. | Application / domain library |
| `lib/invoice.ts` | Shared domain/security helper: invoice. | Application / domain library |
| `lib/logger.ts` | Shared domain/security helper: logger. | Application / domain library |
| `lib/money.ts` | Shared domain/security helper: money. | Application / domain library |
| `lib/permission-guard.ts` | Shared domain/security helper: permission-guard. | Application / domain library |
| `lib/permissions.ts` | Shared domain/security helper: permissions. | Application / domain library |
| `lib/price-rule.ts` | Shared domain/security helper: price-rule. | Application / domain library |
| `lib/prisma.ts` | Shared domain/security helper: prisma. | Application / domain library |
| `lib/product-pricing.ts` | Shared domain/security helper: product-pricing. | Application / domain library |
| `lib/reconciliation.ts` | Shared domain/security helper: reconciliation. | Application / domain library |
| `lib/security.ts` | Shared domain/security helper: security. | Application / domain library |
| `lib/session.ts` | Shared domain/security helper: session. | Application / domain library |
| `lib/test-user-seed.ts` | Shared domain/security helper: test-user-seed. | Application / domain library |
| `lib/tester-boundary.ts` | Shared domain/security helper: tester-boundary. | Application / domain library |
| `lib/toggle-state.ts` | Shared domain/security helper: toggle-state. | Application / domain library |
| `lib/totp.ts` | Shared domain/security helper: totp. | Application / domain library |
| `lib/uploads.ts` | Shared domain/security helper: uploads. | Application / domain library |
| `middleware.ts` | Project support file: middleware.ts. | Repository / support |
| `next-env.d.ts` | Project support file: next-env.d.ts. | Repository / support |
| `next.config.ts` | Project toolchain/configuration: next.config.ts. | Repository / configuration |
| `package-lock.json` | Project toolchain/configuration: package-lock.json. | Repository / configuration |
| `package.json` | Project toolchain/configuration: package.json. | Repository / configuration |
| `playwright.config.ts` | Project toolchain/configuration: playwright.config.ts. | Repository / configuration |
| `postcss.config.js` | Project support file: postcss.config.js. | Repository / support |
| `present/README.md` | Presentation controls, assets, and deterministic regeneration instructions. | Presentation / UI evidence |
| `present/desktop/00-login.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/desktop/01-admin-home.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/desktop/02-admin-console.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/desktop/03-admin-users.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/desktop/04-admin-branches.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/desktop/05-admin-products.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/desktop/06-admin-roles.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/desktop/07-admin-audit-logs.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/desktop/08-admin-cylinders.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/desktop/09-admin-inventory.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/desktop/10-admin-finance.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/desktop/11-admin-reconciliation.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/desktop/12-profile-security.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/desktop/13-gm-home.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/desktop/14-gm-users.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/desktop/15-gm-branches.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/desktop/16-gm-products.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/desktop/17-gm-roles.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/desktop/18-gm-inventory.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/desktop/19-gm-finance.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/desktop/20-gm-reconciliation.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/desktop/21-mgr-home.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/desktop/22-mgr-dashboard.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/desktop/23-mgr-users.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/desktop/24-mgr-inventory.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/desktop/25-mgr-all-sales.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/desktop/26-mgr-reconciliation.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/desktop/27-mgr-settings.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/desktop/28-loader-home.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/desktop/29-sales-home.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/desktop/30-sales-history.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/desktop/31-sales-neworder.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/hero/01_title.png` | Generated conceptual illustration used by the presentation deck. | Presentation / UI evidence |
| `present/hero/02_roles.png` | Generated conceptual illustration used by the presentation deck. | Presentation / UI evidence |
| `present/hero/03_salesman.png` | Generated conceptual illustration used by the presentation deck. | Presentation / UI evidence |
| `present/hero/04_loader.png` | Generated conceptual illustration used by the presentation deck. | Presentation / UI evidence |
| `present/hero/05_manager.png` | Generated conceptual illustration used by the presentation deck. | Presentation / UI evidence |
| `present/hero/06_admin.png` | Generated conceptual illustration used by the presentation deck. | Presentation / UI evidence |
| `present/hero/07_mobile.png` | Generated conceptual illustration used by the presentation deck. | Presentation / UI evidence |
| `present/hero/08_money.png` | Generated conceptual illustration used by the presentation deck. | Presentation / UI evidence |
| `present/hero/09_closing.png` | Generated conceptual illustration used by the presentation deck. | Presentation / UI evidence |
| `present/hero/10_gm.png` | Generated conceptual illustration used by the presentation deck. | Presentation / UI evidence |
| `present/index.html` | Self-contained accessible manager presentation deck. | Presentation / UI evidence |
| `present/mobile/00-login.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/mobile/01-admin-home.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/mobile/02-admin-console.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/mobile/03-admin-users.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/mobile/08-admin-cylinders.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/mobile/10-admin-finance.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/mobile/13-gm-home.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/mobile/14-gm-users.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/mobile/19-gm-finance.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/mobile/21-mgr-home.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/mobile/22-mgr-dashboard.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/mobile/23-mgr-users.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/mobile/28-loader-home.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/mobile/29-sales-home.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/mobile/30-sales-history.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `present/mobile/31-sales-neworder.png` | Live application screenshot used by the presentation deck. | Presentation / UI evidence |
| `presentation/README.md` | Project documentation: README.md. | Repository / documentation |
| `presentation/Sales_Project_Presentation.pptx` | Project support file: Sales_Project_Presentation.pptx. | Repository / support |
| `presentation/project-presentation.html` | Project support file: project-presentation.html. | Repository / support |
| `presentation/project-presentation.mp4` | Project support file: project-presentation.mp4. | Repository / support |
| `presentation/project-presentation.pdf` | Project support file: project-presentation.pdf. | Repository / support |
| `presentation/shot_admin.png` | Static image asset: shot_admin.png. | Application / static assets |
| `presentation/shot_allsales.png` | Static image asset: shot_allsales.png. | Application / static assets |
| `presentation/shot_audit.png` | Static image asset: shot_audit.png. | Application / static assets |
| `presentation/shot_loader.png` | Static image asset: shot_loader.png. | Application / static assets |
| `presentation/shot_login.png` | Static image asset: shot_login.png. | Application / static assets |
| `presentation/shot_m_admin.png` | Static image asset: shot_m_admin.png. | Application / static assets |
| `presentation/shot_m_login.png` | Static image asset: shot_m_login.png. | Application / static assets |
| `presentation/shot_m_neworder.png` | Static image asset: shot_m_neworder.png. | Application / static assets |
| `presentation/shot_m_users.png` | Static image asset: shot_m_users.png. | Application / static assets |
| `presentation/shot_manager.png` | Static image asset: shot_manager.png. | Application / static assets |
| `presentation/shot_neworder.png` | Static image asset: shot_neworder.png. | Application / static assets |
| `presentation/shot_reconcile_fin.png` | Static image asset: shot_reconcile_fin.png. | Application / static assets |
| `presentation/shot_reconcile_log.png` | Static image asset: shot_reconcile_log.png. | Application / static assets |
| `presentation/shot_roles.png` | Static image asset: shot_roles.png. | Application / static assets |
| `presentation/shot_users.png` | Static image asset: shot_users.png. | Application / static assets |
| `prisma.config.ts` | Project toolchain/configuration: prisma.config.ts. | Repository / configuration |
| `prisma/migrations/20260706000000_initial/migration.sql` | Database migration for the named schema/data change. | Data / migrations |
| `prisma/migrations/20260706010000_fix_debt_schema/migration.sql` | Database migration for the named schema/data change. | Data / migrations |
| `prisma/migrations/20260706030000_add_customer_credit/migration.sql` | Database migration for the named schema/data change. | Data / migrations |
| `prisma/migrations/20260706040000_add_audit_log/migration.sql` | Database migration for the named schema/data change. | Data / migrations |
| `prisma/migrations/20260723010000_remove_trucks_and_harden_sessions/migration.sql` | Database migration for the named schema/data change. | Data / migrations |
| `prisma/migrations/20260723020000_consolidate_manager_roles/migration.sql` | Database migration for the named schema/data change. | Data / migrations |
| `prisma/migrations/20260723030000_customer_credit_and_discrepancies/migration.sql` | Database migration for the named schema/data change. | Data / migrations |
| `prisma/migrations/20260723040000_add_mfa/migration.sql` | Database migration for the named schema/data change. | Data / migrations |
| `prisma/migrations/20260828000000_backfill_tax_rate_and_admin_role/migration.sql` | Database migration for the named schema/data change. | Data / migrations |
| `prisma/migrations/20260828010000_add_mfa_recovery_codes/migration.sql` | Database migration for the named schema/data change. | Data / migrations |
| `prisma/migrations/20260828020000_add_write_off_payment/migration.sql` | Database migration for the named schema/data change. | Data / migrations |
| `prisma/migrations/20260829000000_cylinder_serial_tracking/migration.sql` | Database migration for the named schema/data change. | Data / migrations |
| `prisma/migrations/20260831000000_master_tester/migration.sql` | Database migration for the named schema/data change. | Data / migrations |
| `prisma/migrations/20260831010000_redact_audit_secrets/migration.sql` | Database migration for the named schema/data change. | Data / migrations |
| `prisma/migrations/20260831011000_invoice_write_off_amount/migration.sql` | Database migration for the named schema/data change. | Data / migrations |
| `prisma/migrations/20260831012000_audit_effective_user/migration.sql` | Database migration for the named schema/data change. | Data / migrations |
| `prisma/migrations/20260831013000_separate_global_sales_visibility/migration.sql` | Database migration for the named schema/data change. | Data / migrations |
| `prisma/migrations/migration_lock.toml` | Project support file: migration_lock.toml. | Repository / support |
| `prisma/schema.prisma` | Authoritative PostgreSQL/Prisma data model and constraints. | Data / Prisma |
| `prisma/seed.ts` | Development seed data, including guarded canonical test accounts. | Data / Prisma |
| `project_history.md` | Append-only maintenance, verification, and future-work ledger. | Repository / documentation |
| `public/.gitkeep` | Project support file: .gitkeep. | Repository / support |
| `scripts/backup-postgres.sh` | Operational/build script: backup-postgres.sh. | Operations / tooling |
| `scripts/bootstrap-admin.ts` | Operational/build script: bootstrap-admin.ts. | Operations / tooling |
| `scripts/capture-presentation.mjs` | Deterministic role-aware presentation screenshot capture support. | Presentation / tooling |
| `scripts/check-financial-invariant.ts` | Operational/build script: check-financial-invariant.ts. | Operations / tooling |
| `scripts/make-products-global.ts` | Operational/build script: make-products-global.ts. | Operations / tooling |
| `scripts/migrate-podman-to-docker.sh` | Operational/build script: migrate-podman-to-docker.sh. | Operations / tooling |
| `scripts/presentation-routes.json` | Deterministic role-aware presentation screenshot capture support. | Presentation / tooling |
| `scripts/retention.ts` | Operational/build script: retention.ts. | Operations / tooling |
| `scripts/sync-presentation.sh` | Operational/build script: sync-presentation.sh. | Operations / tooling |
| `tailwind.config.ts` | Project support file: tailwind.config.ts. | Repository / support |
| `tests/access.test.ts` | Regression or integration test: access.test.ts. | Quality / tests |
| `tests/all-sales.test.ts` | Regression or integration test: all-sales.test.ts. | Quality / tests |
| `tests/audit-export.test.ts` | Regression or integration test: audit-export.test.ts. | Quality / tests |
| `tests/audit-filter.test.ts` | Regression or integration test: audit-filter.test.ts. | Quality / tests |
| `tests/audit-ui.test.ts` | Regression or integration test: audit-ui.test.ts. | Quality / tests |
| `tests/audit.test.ts` | Regression or integration test: audit.test.ts. | Quality / tests |
| `tests/auth-concurrency.test.ts` | Regression or integration test: auth-concurrency.test.ts. | Quality / tests |
| `tests/bootstrap-admin.test.ts` | Regression or integration test: bootstrap-admin.test.ts. | Quality / tests |
| `tests/bootstrap-company.test.ts` | Regression or integration test: bootstrap-company.test.ts. | Quality / tests |
| `tests/compose.test.ts` | Regression or integration test: compose.test.ts. | Quality / tests |
| `tests/csv.test.ts` | Regression or integration test: csv.test.ts. | Quality / tests |
| `tests/cylinders.test.ts` | Regression or integration test: cylinders.test.ts. | Quality / tests |
| `tests/database.integration.ts` | Regression or integration test: database.integration.ts. | Quality / tests |
| `tests/date-format.test.ts` | Regression or integration test: date-format.test.ts. | Quality / tests |
| `tests/debt-collection.test.ts` | Regression or integration test: debt-collection.test.ts. | Quality / tests |
| `tests/debt-filter.test.ts` | Regression or integration test: debt-filter.test.ts. | Quality / tests |
| `tests/debt-lock.test.ts` | Regression or integration test: debt-lock.test.ts. | Quality / tests |
| `tests/dependencies.test.ts` | Regression or integration test: dependencies.test.ts. | Quality / tests |
| `tests/e2e-adversarial.mts` | Regression or integration test: e2e-adversarial.mts. | Quality / tests |
| `tests/e2e-company.mts` | Regression or integration test: e2e-company.mts. | Quality / tests |
| `tests/e2e-route-gate.mts` | Regression or integration test: e2e-route-gate.mts. | Quality / tests |
| `tests/e2e/accounts.spec.ts` | Playwright end-to-end test: accounts.spec.ts. | Quality / end-to-end tests |
| `tests/e2e/admin-workflow.spec.ts` | Playwright end-to-end test: admin-workflow.spec.ts. | Quality / end-to-end tests |
| `tests/e2e/operational-flow.spec.ts` | Playwright end-to-end test: operational-flow.spec.ts. | Quality / end-to-end tests |
| `tests/finance.test.ts` | Regression or integration test: finance.test.ts. | Quality / tests |
| `tests/impersonate.test.ts` | Regression or integration test: impersonate.test.ts. | Quality / tests |
| `tests/inventory.test.ts` | Regression or integration test: inventory.test.ts. | Quality / tests |
| `tests/invoice-lines.test.ts` | Regression or integration test: invoice-lines.test.ts. | Quality / tests |
| `tests/invoice-ui.test.ts` | Regression or integration test: invoice-ui.test.ts. | Quality / tests |
| `tests/middleware.test.ts` | Regression or integration test: middleware.test.ts. | Quality / tests |
| `tests/money.test.ts` | Regression or integration test: money.test.ts. | Quality / tests |
| `tests/permissions.test.ts` | Regression or integration test: permissions.test.ts. | Quality / tests |
| `tests/presentation-a11y.test.ts` | Regression or integration test: presentation-a11y.test.ts. | Quality / tests |
| `tests/presentation-capture.test.ts` | Regression or integration test: presentation-capture.test.ts. | Quality / tests |
| `tests/price-rule.test.ts` | Regression or integration test: price-rule.test.ts. | Quality / tests |
| `tests/product-pricing.test.ts` | Regression or integration test: product-pricing.test.ts. | Quality / tests |
| `tests/reconciliation.test.ts` | Regression or integration test: reconciliation.test.ts. | Quality / tests |
| `tests/roles-ui.test.ts` | Regression or integration test: roles-ui.test.ts. | Quality / tests |
| `tests/security-ui.test.ts` | Regression or integration test: security-ui.test.ts. | Quality / tests |
| `tests/security.test.ts` | Regression or integration test: security.test.ts. | Quality / tests |
| `tests/server-component-ui.test.ts` | Regression or integration test: server-component-ui.test.ts. | Quality / tests |
| `tests/test-user-seed.test.ts` | Regression or integration test: test-user-seed.test.ts. | Quality / tests |
| `tests/tester-boundary.test.ts` | Regression or integration test: tester-boundary.test.ts. | Quality / tests |
| `tests/tester-ui.test.ts` | Regression or integration test: tester-ui.test.ts. | Quality / tests |
| `tests/toggle-state.test.ts` | Regression or integration test: toggle-state.test.ts. | Quality / tests |
| `tests/ui-style.test.ts` | Regression or integration test: ui-style.test.ts. | Quality / tests |
| `tests/write-off.test.ts` | Regression or integration test: write-off.test.ts. | Quality / tests |
| `tsconfig.json` | Project toolchain/configuration: tsconfig.json. | Repository / configuration |
