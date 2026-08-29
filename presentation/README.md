# Cylinder Operations Platform — National Industrial Gas Plant (Oman)

Manager-facing presentation for the gas-cylinder tracking & sales ERP.
All files are in this folder. The HTML deck is the one to host on your domain.

## Files

- **project-presentation.html** — the deck to share/host (16:9 slides, device-framed screenshots).
  Open in any browser. Print → Save as PDF for a static copy. Needs the `shot_*.png` files alongside it.
- **project-presentation.pdf** — 12 pages, true 16:9 (960×540pt), for email/print.
- **Sales_Project_Presentation.pptx** — Google Slides / PowerPoint import (drag into Google Slides, or open in PowerPoint). 12 slides, images embedded.
- **project-presentation.mp4** — ~3.5 min narrated video walkthrough (English voiceover), 1280×720 (16:9).
- **shot_*.png** — real application screenshots (desktop + mobile) embedded in the deck.

## 12 slides (16:9)

1.  Cover — "Cylinder Operations, Finally Under Control" + outcome stats
2.  Why this exists — the three leaks (missing cylinders, cash, accountability)
3.  The Big Picture — cylinder lifecycle flow (warehouse → loader → salesman → customer → reconcile)
4.  What you get — six capabilities
5.  Inside the application — real screens (desktop)
6.  Mobile & Responsive — phone screens
7.  Sales & Invoicing — Before → Now
8.  Inventory & Reconciliation — Before → Now
9.  Finance & Receivables — Before → Now
10. Trust & Control — roles, security, audit
11. Proof it works — verified
12. What's next — recommendations & close

## Hosting on mahmoudbox.com

The HTML file is self-contained except for the `shot_*.png` images. Upload
`project-presentation.html` and the `shot_*.png` files together to the same
directory on the domain (e.g. `/presentation/`). Open the HTML in a browser.

## Screenshots

Captured from a live, seeded instance (admin + salesman sessions, demo data).
Real UI, not mockups. "Mobile" = the responsive web UI at a phone viewport
(there is no separate native mobile app in this repo).

## Regeneration (if needed)

- PDF + MP4: headless Chrome (`--print-to-pdf`) + ffmpeg from the HTML.
- PPTX: python-pptx from the same screenshots.
- MP4 narration: Microsoft Edge TTS (en-US-GuyNeural), one track per slide.
