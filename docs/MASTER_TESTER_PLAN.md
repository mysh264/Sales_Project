# Master Tester — Implementation Plan

## Goal
A single "tester" account that, from one browser tab, can log in once and then
impersonate any of the canonical test users in the DB. Switching reissues the
session cookie as that user, shows a clear banner, and writes an audit log.
The 15-tab workflow collapses to one tab.

## Scope (from your answers)
- **B — real impersonation** (not a superuser, not a launcher page).
- **Dev/test only** behind `MASTERTESTER_ENABLED=true` (off by default, easy to flip on).
- **Switcher shows only the canonical seeded test users** (one per role+branch combo).

## Coverage matrix (verified against your live DB)
- Roles: ADMIN, GENERAL_MANAGER, MANAGER, LOADER, SALESMAN (5)
- Branches: SUHAR_MAIN, BRANCH_A, BRANCH_B (3)
- **11 canonical test users** total:
  - 1 ADMIN  (branch-independent → assigned SUHAR_MAIN as a default home)
  - 1 GENERAL_MANAGER (branch-independent → assigned SUHAR_MAIN as a default home)
  - 1 MANAGER per branch  ×3 = 3
  - 1 LOADER per branch  ×3 = 3
  - 1 SALESMAN per branch ×3 = 3
  - Total: 11. (You said "15" — 11 is the complete matrix; we can add more per role per branch if you want, e.g. 2 salesmen per branch; just say.)

## Design

### 1. New role + permission
- Add `UserRole.TESTER` to the Prisma enum.
- Add `Permissions.TESTER_Impersonate` to `lib/permissions.ts`.
- Update `roleHome`: `TESTER -> "/tester"`.
- The tester is the only holder of `TESTER_Impersonate` (regular admins do NOT get it; that's the gate).

### 2. Env-gated
- New vars in `.env.example`:
  - `MASTERTESTER_ENABLED=true` (default false; when false, the seed skips and the routes return 404).
  - `MASTERTESTER_PASSWORD=…` (the tester's own password, ≥12 chars).
  - `MASTERTESTER_EMAIL=tester@mahmoudbox.com` (default).
- The tester's own role is `TESTER`, not `ADMIN`, so the regular admin flow is untouched.

### 3. The seeded test users (canonical)
- Add to `prisma/seed.ts` (idempotent upserts):
  - `test.admin@mahmoudbox.com`  (ADMIN, no branch)
  - `test.gm@mahmoudbox.com`     (GENERAL_MANAGER, no branch)
  - `test.manager.{suhar|bra|brb}@mahmoudbox.com` (MANAGER × branches)
  - `test.loader.{suhar|bra|brb}@mahmoudbox.com`  (LOADER × branches)
  - `test.salesman.{suhar|bra|brb}@mahmoudbox.com` (SALESMAN × branches)
- All have a fixed, published password from `.env` (`TESTER_CANNONICAL_PASSWORD`).
  When that env is absent in dev, a default value is used and the seed logs it.
- All are tagged with `isTestUser=true` (new column on `User` — see §4).

### 4. Schema changes (one Prisma migration)
- `UserRole` enum: add `TESTER`.
- `User` model: add `isTestUser Boolean @default(false)` (indexed).
- The tester login + the canonical test users are the only rows with `isTestUser=true`.

### 5. Server actions
- `app/actions/impersonate.ts`:
  - `startImpersonation(targetUserId)` — only callable if (a) caller has
    `TESTER_Impersonate` AND (b) `MASTERTESTER_ENABLED=true` AND (c) target
    has `isTestUser=true`. Reissues the session cookie with the target's
    payload + sets `impersonatorId` to the tester's id. Writes audit log:
    `impersonate.start { tester, target, ip }`.
  - `stopImpersonation()` — reissues cookie as the original tester. Audit:
    `impersonate.stop { tester, target, ip }`.
- Both write to the existing `AuditLog` (no new table).

### 6. Pages
- `/tester` (gated): the launchpad. Top: "You are signed in as tester". Below:
  a list of the 11 canonical test users (filter by role/branch). Each row has
  "Impersonate" → calls `startImpersonation`. Also a quick links strip to the
  tester-only audit page.
- `/tester/audit` (gated): last 100 impersonation events from the audit log.
- A small `<ImpersonationBanner>` component rendered in the global layout,
  shown whenever `session.impersonatorId` is set:
  - "⚠ You are impersonating **Test Salesman (BRANCH_A)**. Original session: tester@…  [Stop]"

### 7. Middleware
- `middleware.ts` is unchanged for normal routes (the impersonated session is
  just a normal cookie with that user's role+perms). The only addition is the
  matcher entry for `/tester` and `/tester/:path*`.
- The impersonation reissue goes through the existing session cookie code path,
  so JWT secret, expiry, etc. are all consistent.

### 8. Tests (16 must stay green; add 4 new)
- The 16 existing unit tests must still pass (I'll re-run after the changes).
- Add 4 new tests in `tests/impersonate.test.ts`:
  1. Tester can start impersonation of a canonical test user.
  2. Non-tester with `Users_Update` cannot (403).
  3. Trying to impersonate a non-canonical (non-test) user is denied.
  4. `stopImpersonation` restores the tester's session payload.

### 9. Files touched (estimate)
- `prisma/schema.prisma` + 1 migration.
- `prisma/seed.ts` (add the 11 test users + tester).
- `lib/permissions.ts` (add `TESTER_Impersonate`).
- `lib/auth.ts` (add `TESTER` to `roleHome`).
- `lib/session.ts` (extend `SessionPayload` with `impersonatorId?`).
- `app/actions/impersonate.ts` (new).
- `app/tester/page.tsx` (new, launchpad).
- `app/tester/audit/page.tsx` (new).
- `components/ImpersonationBanner.tsx` (new).
- `app/layout.tsx` (add the banner).
- `app/api/impersonate/*` (if needed for any client fetch — probably not, server actions suffice).
- `middleware.ts` (matcher entry).
- `.env.example` (3 new vars).
- `tests/impersonate.test.ts` (4 new tests).

### 10. Safety / honesty
- The test users + tester only exist when `MASTERTESTER_ENABLED=true`. On the
  company server (prod), you leave the flag off in `.env` and they don't get
  seeded.
- Impersonation of non-canonical users is impossible (the `isTestUser` gate
  runs server-side).
- Every switch is in the audit log. A real production flag is a one-line flip.
- The banner makes "who am I right now" unambiguous at all times.

### 11. After approval, I'll execute
1. Schema + migration (no data loss; additive column with a default).
2. Seed additions (idempotent upserts).
3. Permission + role constant updates.
4. Server actions.
5. Pages + banner.
6. 4 new tests.
7. Run lint + typecheck + tests + build. Commit.
8. Ping you with the tester email/password and the URL.

## What I need from you before I start
- OK to add `isTestUser` to the `User` table? (1 new boolean column, default false, indexed; non-destructive.)
- Is the 11-user matrix fine, or do you actually want more (e.g. 2 SALESMEN per branch = 15)? If 15, say and I'll size it to 2×salesman+loader per branch.
- Anything else gated to the env flag (e.g. should `MASTERTESTER_ENABLED=false` also HIDE the /tester routes entirely, or 404 them with a friendly message)?
