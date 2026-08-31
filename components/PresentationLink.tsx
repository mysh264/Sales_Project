// "View Presentation" link rendered on the login screen (and any other
// surface that imports it). Opens the deck in a new tab so the login
// flow is not interrupted. The link target is the static HTML under
// public/presentation/, mirrored from the committed present/ source by
// scripts/sync-presentation.sh (npm run prebuild).
//
// Visual: a small, modern floating pill. Brand gradient, soft ring,
// slight lift on hover, focus ring for keyboard users. No external
// icon font — the play glyph is an inline SVG so the component has
// zero runtime dependencies and renders identically on every device.
import Link from "next/link";

export function PresentationLink({ href = "/presentation", label = "View Presentation" }: { href?: string; label?: string }) {
  return (
    <Link
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} (opens in a new tab)`}
      // /presentation/index.html (the deck's actual file under public/).
      // Next's public/ serving does not auto-resolve directories to
      // index.html, so we link to the file explicitly.
      href={`${href.replace(/\/index\.html$/, "")}/index.html`}
      className="
        group inline-flex items-center gap-2
        rounded-full bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600
        px-4 py-2
        text-sm font-bold text-white
        shadow-lg shadow-violet-500/25
        ring-1 ring-white/20
        backdrop-blur-sm
        transition-all duration-200 ease-out
        hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-500/40 hover:ring-white/40
        focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900
        active:translate-y-0 active:shadow-md
      "
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4 transition-transform duration-200 group-hover:scale-110"
        fill="currentColor"
      >
        {/* Play triangle. Rounded corners for a softer, modern look. */}
        <path d="M8 5.5v13a1 1 0 0 0 1.55.83l10-6.5a1 1 0 0 0 0-1.66l-10-6.5A1 1 0 0 0 8 5.5Z" />
      </svg>
      <span className="hidden sm:inline">{label}</span>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="hidden h-3.5 w-3.5 opacity-70 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0.5 sm:inline"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Small "open in new tab" affordance */}
        <path d="M7 17 17 7" />
        <path d="M8 7h9v9" />
      </svg>
    </Link>
  );
}
