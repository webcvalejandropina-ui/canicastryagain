import type { WorldMotif } from "./worlds";

/** Shared vector alphabet: new themes compose motifs instead of forking components. */
export function WorldSymbol({kind, className, surface = false}: {kind: WorldMotif; className?: string; surface?: boolean}): React.ReactElement | null {
  if (kind === "none") return null;
  return <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    {kind === "lantern" ? <><path d="M16 2v4m0 20v4" stroke="currentColor" strokeWidth="2"/><ellipse cx="16" cy="16" rx="10" ry="11" fill="currentColor"/><path d="M13 6c-5 6-5 14 0 20m6-20c5 6 5 14 0 20M6 16h20" stroke="#fff5cc" strokeWidth="1.3"/><path d="M11 5h10M11 27h10" stroke="#8a3833" strokeWidth="2"/></> : null}
    {kind === "flower" ? <g fill="currentColor"><ellipse cx="16" cy="9" rx="4" ry="7"/><ellipse cx="16" cy="23" rx="4" ry="7"/><ellipse cx="9" cy="16" rx="7" ry="4"/><ellipse cx="23" cy="16" rx="7" ry="4"/><circle cx="16" cy="16" r="4" fill="#f4d68a"/></g> : null}
    {kind === "petal" ? <path d="M8 27C0 10 12 3 27 5c1 15-6 26-19 22Z" fill="currentColor"/> : null}
    {kind === "flame" ? <><path d="M17 2C20 13 30 13 26 24 21 35 2 30 6 18c1-4 4-6 5-9 0 7 3 7 4 9 4-4 3-10 2-16Z" fill="currentColor"/><path d="M16 16c1 5 8 8 3 12-6 3-10-3-6-7Z" fill="#fff0b9"/></> : null}
    {kind === "spark" ? <path d="m16 2 3 10 11 4-11 3-3 11-4-11L2 16l10-4Z" fill="currentColor"/> : null}
    {kind === "ribbon" ? <path d="m3 7 13 8L29 7l-5 12-8-2-2 13-5-7 4-7-7 2Z" fill="#d84e50"/> : null}
    {kind === "pumpkin" && surface ? <><path fill="currentColor" d="m7 13 6-4-1 6Zm18 0-6-4 1 6ZM13 18h6l-3-3Zm-7 1 6 3 2-2 2 3 2-3 2 2 6-3-3 7H9Z"/><path d="M16 8c-1-4 1-6 4-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></> : kind === "pumpkin" ? <><path fill="currentColor" d="M15 9C3 2 0 27 10 28c3 1 4-1 6 0s3 1 6 0C32 27 29 2 17 9Z"/><path fill="var(--die-cutout, #48271b)" d="m9 14 4 3H7Zm14 0-4 3h6ZM9 22l7 3 7-3-3 5h-8Z"/><path d="M16 10q-3-7 4-8" stroke="currentColor" strokeWidth="2.5"/></> : null}
    {kind === "bat" ? <path fill="currentColor" d="m15 11-2-4-1 6-10-3 4 9 5-2 5 7 5-7 5 2 4-9-10 3-1-6-2 4Z"/> : null}
    {kind === "ghost" ? <><path fill="currentColor" d="M6 27V13C6 0 26 0 26 13v15l-5-4-5 4-5-4Z"/><ellipse cx="12" cy="13" rx="2" ry="3" fill="var(--die-deep)"/><ellipse cx="21" cy="13" rx="2" ry="3" fill="var(--die-deep)"/></> : null}
    {kind === "snow" ? <path d="M16 3v26M5 9l22 14M5 23 27 9M11 6l5 5 5-5m-10 20 5-5 5 5M6 14l6 1-1-6m15 9-6-1 1 6M6 18l6-1-1 6m15-9-6 1 1-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/> : null}
    {kind === "hat" ? <><path fill="#ca4e48" d="M8 17 19 5l5 13Z"/><path stroke="#fff8df" strokeWidth="3.4" strokeLinecap="round" d="m7 18 18 1"/><circle fill="#fff8df" cx="19" cy="5" r="2.4"/></> : null}
    {kind === "sun" ? <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="16" cy="16" r="5" fill="currentColor"/><path d="M16 4v3m0 18v3M4 16h3m18 0h3M7.5 7.5l2 2m13 13 2 2m0-17-2 2m-13 13-2 2"/></g> : null}
    {kind === "glasses" ? <path fill="currentColor" d="M5 12h22v3h-1l-2 6h-7l-1-5-1 5H8l-2-6H5Zm6 11c3 2 7 2 10 0l-1 3h-8Z"/> : null}
    {kind === "bubble" ? <><circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="1.4"/><path d="M10 12q1-3 5-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></> : null}
    {kind === "star" ? <path fill="currentColor" d="m16 3 4 8 9 2-7 7 1 9-7-4-8 4 1-9-7-7 10-2Z"/> : null}
    {kind === "gift" ? <g stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M6 15h20v14H6Zm-2-5h24v5H4Zm12 0v19m0-19C2 11 5-4 12 4l4 6c14 1 11-14 4-6Z"/></g> : null}
    {kind === "confetti" ? <g stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="m6 6 4 5m13-7-1 6m-4 12 5 5M4 24l5-3"/><path d="m15 12 2 4 4 1-3 3"/></g> : null}
  </svg>;
}
