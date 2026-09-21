# Sales & Cylinder Tracking — Manager Presentation

Self-contained HTML slide deck. Open `index.html` in any modern browser.

## Controls
- **Arrow keys (← →)** — previous / next slide
- **Space / PageDown** — next
- **Home / End** — first / last
- **Click** the right third of the screen to advance, left third to go back
- **Swipe** on touch devices
- **Dots** on the right edge jump to a specific slide
- **Prev/Next** buttons at the bottom center

## Structure
- 14 slides, each with a distinct color/mood gradient matched to the content
- Inline CSS (no build step) and inline JS (no dependencies)
- Local PNGs only — works fully offline once the folder is copied

## Assets
- `hero/` — 10 generated concept images (title, roles, salesman, loader, manager, admin, mobile, money, gm, closing)
- `desktop/` — 32 real screenshots of every key route across 5 roles (1920×938 viewport)
- `mobile/` — 16 real screenshots of high-value pages on phone viewport (375×812 at 2× pixel density)

## Source
Screenshots captured live from `https://sales.mahmoudbox.com` after the deployment
passed its health check. Hero imagery was generated with the project's image-generation tool.

## Regenerating screenshots
Run the capture from the project host while the `sales_nextjs` container is healthy:
```
node scripts/capture-presentation.mjs
```
The script uses active canonical test users from the running container, mints short-lived
sessions without printing credentials or tokens, and overwrites only the known files in
`present/desktop/` and `present/mobile/`. It aborts on non-200 or unauthorized routes so
tunnel error pages cannot silently become presentation assets.

## Regenerating hero images
The prompts are in the commit that introduced this folder. The image generator
backend (FAL via Nous Portal) produced 16:9 PNGs at 1MP+.
