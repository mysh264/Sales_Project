---
name: sales-oman-ui
description: Visual and UX conventions for the Omani gas Sales ERP (Next.js App Router). Use when editing Sales_Project UI, Tailwind tokens, salesman/loader/login screens, or mobile field layouts.
---

# Sales Oman UI

## Brand (locked)

- Industrial Oman gas field look: **teal/steel** primary, **safety orange** accent.
- Do **not** reintroduce indigo/violet/purple SaaS gradients.
- Tokens live in `tailwind.config.ts` (`brand`, `safety`) and `app/globals.css` (`:root --brand` + shadcn HSL vars).
- shadcn primitives live under `components/ui/` (`shadcn-button`, `input`, `dialog`, `table`, …); product APIs (`Button`, `PageHeader`, `TopNav`) wrap them.

## Surfaces

- Page shell: `bg-app-bg` + `PageHeader` + `ui-card` / `Stat` / `ui-table` (or shadcn `Table`).
- Buttons: product `Button` variants → shadcn (`primary`→`default`, etc.). Prefer `Button` / `ButtonLink` in app code.
- Never hard-code `bg-purple-600` on nav extras; use `ui-nav-link`.

## Mobile field rules

- TopNav: hamburger drawer below `md`; no multi-line wrap soup.
- Invoice lines: stack vertically on small screens — **no** `min-w-[760px]` product grids.
- Touch targets ≥ 44px; sticky submit bars use `pb-safe` / `safe-area-inset-bottom`.
- Prefer `formatMoney(amount, currency)` from `lib/money.ts` over hardcoded OMR formatters.

## Locale

- Root `html` uses `lang`/`dir` from `lib/i18n.ts`.
- Expand role strings via `t()` when touching surfaces; do not invent a second i18n system.

## Stack

- Next.js 15 App Router + Server Actions + Prisma 7 + Tailwind + **shadcn/ui** (Radix).
- Auth stays project JWT — no Clerk.
