# Graph Report - Sales_Project  (2026-09-21)

## Corpus Check
- 230 files · ~78,637 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 942 nodes · 2597 edges · 44 communities (35 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Branch Inventory Actions
- Auth Impersonation Session
- Audit Log UI
- Prisma Bootstrap Company
- Admin Routes Attachments
- Loader Reconciliation Actions
- Finance Summary Actions
- Sales Invoice Creation
- E2E Adversarial Tests
- Cylinder Statement Pages
- Permissions Role Profiles
- New Invoice Form
- Manager GM Dashboards
- Package TypeScript Config
- User Management Actions
- Admin Console Users
- Playwright Presentation Capture
- TypeScript Compiler Config
- Dev Dependencies
- NPM Scripts Lifecycle
- Loader Handoff UI
- Role Model Concepts
- Docker Deploy Stack
- All Sales Reporting
- Accounting Risk Concepts
- Runtime Dependencies
- ERP Workflow Verification
- Master Tester Facility
- Project Docs Roadmap
- NPM Security Overrides
- Auth Trust CI
- AllowScripts Policy
- Podman Docker Migration
- Loader Finance Reconciliation
- ESLint Flat Config
- Tailwind Design Tokens
- Graphify Knowledge Vault
- Next Env Types
- PostCSS Config
- Postgres Backup Script
- Presentation Sync Script
- Omani Gas ERP Concept
- Login Public Gateway

## God Nodes (most connected - your core abstractions)
1. `getCurrentUser()` - 82 edges
2. `next` - 62 edges
3. `requirePermission()` - 55 edges
4. `prisma` - 51 edges
5. `logAction()` - 49 edges
6. `auditSnapshot()` - 38 edges
7. `getBranchScope()` - 32 edges
8. `Permissions` - 32 edges
9. `formatDateTimeDMY()` - 25 edges
10. `createOrder()` - 24 edges

## Surprising Connections (you probably didn't know these)
- `Single Accounting Currency per Customer` --semantically_similar_to--> `CustomerCurrencyBalance Model Option`  [INFERRED] [semantically similar]
  .cursor/plans/sales_project_roadmap_9aa6bee2.plan.md → docs/PROJECT_AUDIT_2026-08-31.md
- `CylindersPage()` --calls--> `getCurrentUser()`  [EXTRACTED]
  app/admin/cylinders/page.tsx → lib/session.ts
- `Project Map` --conceptually_related_to--> `Auth Trust Model`  [INFERRED]
  PROJECT_MAP.md → CONTRIBUTING.md
- `Project Audit 2026-08-31` --conceptually_related_to--> `CI Verify Job`  [INFERRED]
  docs/PROJECT_AUDIT_2026-08-31.md → .github/workflows/ci.yml
- `User Mutation Audit Atomicity Gap` --conceptually_related_to--> `Audit Sensitive Actions via logAction`  [AMBIGUOUS]
  docs/PROJECT_AUDIT_2026-08-31.md → CONTRIBUTING.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Default-deny auth trust boundary** — contributing_auth_trust_model, contributing_api_self_guard_rule, contributing_branch_isolation [EXTRACTED 1.00]
- **Docker Compose production stack** — docker_compose_service_db, docker_compose_service_web, docker_compose_service_backup [EXTRACTED 1.00]
- **P0 production accounting blockers** — docs_project_audit_2026_08_31_multicurrency_credit, docs_project_audit_2026_08_31_user_audit_atomicity, docs_project_audit_2026_08_31_write_off_policy [EXTRACTED 1.00]

## Communities (44 total, 9 thin omitted)

### Community 0 - "Branch Inventory Actions"
Cohesion: 0.05
Nodes (92): saveBranch(), slugify(), text(), CustomerSearchResult, searchCustomers(), adjustInventory(), integer(), text() (+84 more)

### Community 1 - "Auth Impersonation Session"
Cohesion: 0.06
Nodes (49): login(), logout(), text(), envFlag(), isMasterTesterEnabled(), issueSession(), listImpersonationTargets(), listMyImpersonationEvents() (+41 more)

### Community 2 - "Audit Log UI"
Cohesion: 0.06
Nodes (54): AuditLogRow, AuditLogTable(), AuditLogTableProps, AuditUser, ChangeEntry, humanizeAction(), normalizeChangeNode(), prettify() (+46 more)

### Community 3 - "Prisma Bootstrap Company"
Cohesion: 0.07
Nodes (28): generated_prisma_client_prismaclient, bootstrapPasswordNeedsSync(), CompanyRecord, CompanyStore, DEFAULT_COMPANY_DATA, ensureBootstrapCompany(), DEFAULT_ROLE_PERMISSIONS, assertSafeTestIdentity() (+20 more)

### Community 4 - "Admin Routes Attachments"
Cohesion: 0.06
Nodes (34): GET(), LoginForm(), dynamic, money(), PrintPageProps, UnifiedPrintPage(), PrintButton(), ClearNewInvoiceStorage() (+26 more)

### Community 5 - "Loader Reconciliation Actions"
Cohesion: 0.08
Nodes (41): dayOnly(), loadProducts(), normalizeProductRows(), parseRows(), processEveningReturn(), processMorningLoad(), resolveSalesmanContext(), submitEveningReconcile() (+33 more)

### Community 6 - "Finance Summary Actions"
Cohesion: 0.07
Nodes (37): CurrencyTotals, decimalToString(), endOfDay(), FinancialSummary, FinancialSummaryFilters, getFinancialSummary(), startOfDay(), generateStatementShareToken() (+29 more)

### Community 7 - "Sales Invoice Creation"
Cohesion: 0.08
Nodes (37): createOrder(), decimalMax(), moneyValue(), nonNegativeInteger(), parseDate(), percentRate(), text(), dynamic (+29 more)

### Community 8 - "E2E Adversarial Tests"
Cohesion: 0.07
Nodes (21): ref_node_module, advInv, B, invFilter, results, scen(), shouldFail(), shouldPass() (+13 more)

### Community 9 - "Cylinder Statement Pages"
Cohesion: 0.16
Nodes (18): CylindersPage(), dynamic, CustomerStatementPage(), dynamic, dynamic, StatementsPage(), dynamic, dynamic (+10 more)

### Community 10 - "Permissions Role Profiles"
Cohesion: 0.10
Nodes (25): PermissionChecklist(), PermissionChecklistProps, assignablePermissions, legacyPermissionMap, makePermission(), normalizePermission(), normalizePermissions(), permissionLabels (+17 more)

### Community 11 - "New Invoice Form"
Cohesion: 0.12
Nodes (20): CustomerDraft, CustomerOption, fieldClass(), formatOmr(), makeId(), NewInvoiceForm(), addRow(), changeCurrency() (+12 more)

### Community 12 - "Manager GM Dashboards"
Cohesion: 0.14
Nodes (21): dynamic, GeneralManagerPage(), lastSixMonths(), startOfMonth(), activeDebtStatuses, dynamic, endOfMonth(), lastSixMonths() (+13 more)

### Community 13 - "Package TypeScript Config"
Cohesion: 0.10
Nodes (19): name, private, type, version, autoprefixer, dotenv, eslint-config-next, pg (+11 more)

### Community 14 - "User Management Actions"
Cohesion: 0.25
Nodes (15): createUser(), parseRole(), requireRoleManagement(), resolvePermissionProfileId(), text(), toggleGlobalSalesView(), toggleUserStatus(), updateUserRole() (+7 more)

### Community 15 - "Admin Console Users"
Cohesion: 0.17
Nodes (15): AdminConsolePage(), dynamic, roleLabel(), roleOptions, Branch, GLOBAL_ROLES, Props, RoleBranchEditor() (+7 more)

### Community 16 - "Playwright Presentation Capture"
Cohesion: 0.12
Nodes (9): ref_node_child_process, ref_node_url, @playwright/test, captureSet(), manifest, root, tokenCache, tokenForRole() (+1 more)

### Community 17 - "TypeScript Compiler Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 18 - "Dev Dependencies"
Cohesion: 0.12
Nodes (16): devDependencies, autoprefixer, dotenv, eslint, eslint-config-next, @playwright/test, postcss, prisma (+8 more)

### Community 19 - "NPM Scripts Lifecycle"
Cohesion: 0.14
Nodes (14): scripts, build, dev, lint, maintenance:retention, prebuild, prisma:generate, prisma:migrate (+6 more)

### Community 20 - "Loader Handoff UI"
Cohesion: 0.15
Nodes (8): SalesmanHandoffPicker(), SalesmanHandoffPickerProps, SalesmanOption, Size, sizeClass, Variant, variantClass, react

### Community 21 - "Role Model Concepts"
Cohesion: 0.20
Nodes (11): No Privilege Escalation on Role Assignment, MANAGER Role Consolidation, Global Sales Read Visibility Only, System Route Map, ADMIN Role, GENERAL_MANAGER Role, LOADER Role, MANAGER Role (+3 more)

### Community 22 - "Docker Deploy Stack"
Cohesion: 0.27
Nodes (11): Deployment Handoff, Cloudflare Tunnel Entry Point, Docker Compose Stack, docker_shared External Network, pg_dump backup Service, PostgreSQL db Service, Retention maintenance Service, Next.js web Service (+3 more)

### Community 23 - "All Sales Reporting"
Cohesion: 0.33
Nodes (8): AllSalesSearchParams, dynamic, endOfMonth(), formatCurrency(), ManagerAllSalesPage(), nextDay(), parseDate(), startOfMonth()

### Community 24 - "Accounting Risk Concepts"
Cohesion: 0.25
Nodes (9): Audit Sensitive Actions via logAction, Phase 1A Accounting Stability, Single Accounting Currency per Customer, Audit Effective User During Impersonation, Audit Export 5000 Row Cap, CustomerCurrencyBalance Model Option, Multi-Currency Customer Credit Ambiguity, User Mutation Audit Atomicity Gap (+1 more)

### Community 25 - "Runtime Dependencies"
Cohesion: 0.22
Nodes (9): dependencies, bcryptjs, jose, next, pg, @prisma/adapter-pg, @prisma/client, react (+1 more)

### Community 26 - "ERP Workflow Verification"
Cohesion: 0.25
Nodes (8): Mandatory Branch Isolation, Prisma.Decimal Money Rule, Phase 1B Salesman Field UX, ERP Verification Matrix, Manager Finance Workflow, Salesman Invoice Workflow, /salesman/new-order, Invoice Debt Settlement Buckets

### Community 27 - "Master Tester Facility"
Cohesion: 0.29
Nodes (8): MASTERTESTER_ENABLED Feature Flag, Master Tester Plan, 11 Canonical Test Users, isTestUser Impersonation Gate, Master Tester Real Impersonation, TESTER_Impersonate Permission, /tester (implied), TESTER Role

### Community 28 - "Project Docs Roadmap"
Cohesion: 0.48
Nodes (7): Sales Project Roadmap Plan, Project Audit 2026-08-31, Plaintext Statement Share Tokens, Upload Magic-Byte Validation Gap, Project History Ledger, Project Map, Middleware to Server Action Request Flow

### Community 29 - "NPM Security Overrides"
Cohesion: 0.29
Nodes (7): overrides, brace-expansion, deepmerge-ts, find-my-way, postcss, sharp, valibot

### Community 30 - "Auth Trust CI"
Cohesion: 0.33
Nodes (6): Contributing Guide, API Route Self-Guard Rule, Auth Trust Model, Session Invalidation on Credential Changes, GitHub CI Workflow, CI Verify Job

### Community 32 - "AllowScripts Policy"
Cohesion: 0.40
Nodes (5): allowScripts, esbuild@0.28.2, prisma@7.10.0, @prisma/engines@7.10.0, unrs-resolver@1.12.2

### Community 33 - "Podman Docker Migration"
Cohesion: 0.70
Nodes (4): die(), log(), migrate-podman-to-docker.sh script, warn()

### Community 34 - "Loader Finance Reconciliation"
Cohesion: 0.50
Nodes (4): Loader Reconciliation Workflow, /finance/reconciliation-overview, /loader/load/[salesmanId], Daily Reconciliation Flow

### Community 35 - "ESLint Flat Config"
Cohesion: 0.50
Nodes (3): compat, eslint, ref_eslint_eslintrc

## Ambiguous Edges - Review These
- `User Mutation Audit Atomicity Gap` → `Audit Sensitive Actions via logAction`  [AMBIGUOUS]
  docs/PROJECT_AUDIT_2026-08-31.md · relation: conceptually_related_to
- `Audit Export 5000 Row Cap` → `Audit Sensitive Actions via logAction`  [AMBIGUOUS]
  docs/PROJECT_AUDIT_2026-08-31.md · relation: conceptually_related_to

## Knowledge Gaps
- **271 isolated node(s):** `CustomerSearchResult`, `CurrencyTotals`, `FinancialSummary`, `FinancialSummaryFilters`, `DEBT_COLLECTION_METHODS` (+266 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 330 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `User Mutation Audit Atomicity Gap` and `Audit Sensitive Actions via logAction`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Audit Export 5000 Row Cap` and `Audit Sensitive Actions via logAction`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `requirePermission()` connect `Branch Inventory Actions` to `Auth Impersonation Session`, `Audit Log UI`?**
  _High betweenness centrality (0.000) - this node is a cross-community bridge._
- **Why does `getCurrentUser()` connect `Branch Inventory Actions` to `Auth Impersonation Session`?**
  _High betweenness centrality (0.000) - this node is a cross-community bridge._
- **What connects `CustomerSearchResult`, `CurrencyTotals`, `FinancialSummary` to the rest of the system?**
  _271 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Branch Inventory Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.05148353881587861 - nodes in this community are weakly interconnected._
- **Should `Auth Impersonation Session` be split into smaller, more focused modules?**
  _Cohesion score 0.058126619770455384 - nodes in this community are weakly interconnected._