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
- `desktop/` — 32 real screenshots of every key route across 5 roles (1280×800 viewport)
- `mobile/` — 16 real screenshots of high-value pages on phone viewport (375×812)

## Source
Screenshots captured live from `https://sales.mahmoudbox.com` (Cloudflare tunnel) on the
production deployment after all rounds of bug fixes and the recovery-code login field.
Hero imagery generated with the project's image-generation tool.

## Regenerating screenshots
Re-run the scan from the project's host:
```
bash scripts/prescan.sh    # see commit message for details
```
then copy `desktop/*.png` and `mobile/*.png` into this folder.

## Regenerating hero images
The prompts are in the commit that introduced this folder. The image generator
backend (FAL via Nous Portal) produced 16:9 PNGs at 1MP+.
