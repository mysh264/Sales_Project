# Contributing — Sales & Cylinder Tracking ERP

## Architecture
- **Next.js 15 App Router** + React 19 + **Prisma 7** + PostgreSQL (Podman). Served behind a Cloudflare tunnel.
- **Server Components** render data; **Server Actions** (`app/actions/*.ts`) mutate. Always use Server Actions or route handlers — never mutate the DB from a client component.
- **Security core** lives in `lib/`: `auth.ts` (JWT + route→permission map, default-deny), `session.ts` (re-validates `sessionVersion` + `isActive` against the DB), `permissions.ts` (role profiles + privilege-escalation guard), `branch-scope.ts` (branch data isolation), `permission-guard.ts`.
- **Design system**: `app/globals.css` (tokens) + `components/ui/*` (Button, Card, Stat, Badge, Field, PageHeader, TopNav, EmptyState). Prefer these primitives over hand-rolled Tailwind.

## HARD RULES
1. **Every new `/api` route MUST self-guard.** `middleware.ts` allows all `/api/*` through and relies on the route to authenticate/authorize. A new API route MUST call `getCurrentUser()` and apply branch/invoice scoping (e.g. `invoiceAccessWhere`) **before** any DB access. Missing this = silent open endpoint.
2. **Money = `Prisma.Decimal`.** Never use JS `number`/`float` for money. Format for display with `formatMoney()` from `lib/money.ts` (3-decimal OMR) — do not scatter `.toFixed(3)`.
3. **Branch isolation is mandatory.** Any query filtered by branch must go through `branchWhere(scope)` / `canAccessBranch(scope, branchId)` from `lib/branch-scope.ts`. A new role-prefixed route must be added to `routePermissionMap` in `lib/auth.ts` or it is default-denied.
4. **Audit sensitive actions** via `logAction()` in `lib/audit.ts` (auth, role/branch/user changes, finance, debt).
5. **No privilege escalation**: only assign `Role` profiles whose permissions are a subset of the actor's own (`canAssignProfile` in `lib/permissions.ts`).
6. **Session invalidation**: bump `sessionVersion` on password/role/MFA changes so old JWTs die.

## Verification before commit
```bash
export DATABASE_URL="postgresql://<user>:<pass>@localhost:5433/sales?schema=public"
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit   # 0 errors
node node_modules/eslint/bin/eslint.js app lib prisma components --max-warnings=0  # 0 warnings
node node_modules/tsx/dist/cli.mjs --test tests/*.test.ts          # unit tests pass
node node_modules/next/dist/bin/next build                         # builds
```
Run the Playwright e2e suite (`npm run test:e2e`) when changing auth or role flows.

## Conventions
- File naming: kebab-case for routes, PascalCase for components.
- Secrets come from `.env` (never commit). Dynamo/JWT secret must be ≥32 chars.
- UI changes must be verified on **both desktop and mobile** viewports before claiming done.
