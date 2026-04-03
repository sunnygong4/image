"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import type { PublicAlbum } from "@/lib/types";

interface MonthEntry {
  label: string;   // "October"
  slug: string;
}

interface YearGroup {
  year: string;    // "2025"
  months: MonthEntry[];
}

function groupByYear(albums: PublicAlbum[]): YearGroup[] {
  const map = new Map<string, MonthEntry[]>();

  for (const album of albums) {
    // Try to parse "Month YYYY" from title, fallback to startDate year
    const titleMatch = album.title.match(/^([A-Za-z]+)\s+(\d{4})$/);
    let year: string;
    let monthLabel: string;

    if (titleMatch) {
      monthLabel = titleMatch[1]!;
      year = titleMatch[2]!;
    } else if (album.startDate) {
      const d = new Date(album.startDate);
      year = String(d.getFullYear());
      monthLabel = d.toLocaleString("default", { month: "long" });
    } else {
      year = "Other";
      monthLabel = album.title;
    }

    if (!map.has(year)) map.set(year, []);
    map.get(year)!.push({ label: monthLabel, slug: album.slug });
  }

  // Sort years newest-first
  return [...map.entries()]
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([year, months]) => ({ year, months }));
}

export function MonthlySidebar({ albums }: { albums: PublicAlbum[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on navigation
  useEffect(() => { setOpen(false); }, [pathname]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  if (!albums.length) return null;

  const groups = groupByYear(albums);

  return (
    <>
      {/* Toggle button — fixed left edge, vertically centred */}
      <button
        type="button"
        aria-label={open ? "Close monthly highlights" : "Open monthly highlights"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`fixed left-0 top-1/2 z-40 -translate-y-1/2 flex flex-col items-center gap-1.5 rounded-r-2xl border border-l-0 px-2.5 py-4 shadow-soft transition-all duration-300 ${
          open
            ? "border-pine/30 bg-pine text-white"
            : "border-black/10 bg-white/90 text-dusk hover:border-pine/30 hover:text-pine"
        } backdrop-blur-sm`}
      >
        {/* Calendar icon */}
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        {/* Rotated label */}
        <span
          className="font-mono text-[9px] uppercase tracking-[0.2em] leading-none"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          Monthly
        </span>
      </button>

      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Slide-out panel */}
      <div
        ref={panelRef}
        className={`fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r border-black/10 bg-white/96 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/8 px-5 py-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-dusk">
              Archive
            </p>
            <h2 className="display-font mt-0.5 text-xl text-ink">
              Monthly highlights
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 text-dusk transition hover:border-pine/30 hover:text-pine"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable month list */}
        <nav className="flex-1 overflow-y-auto px-4 py-4">
          {groups.map((group) => (
            <div key={group.year} className="mb-5">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-dusk/60">
                {group.year}
              </p>
              <ul className="space-y-0.5">
                {group.months.map((entry) => {
                  const href = `/albums/${entry.slug}`;
                  const isActive = pathname === href;
                  return (
                    <li key={entry.slug}>
                      <Link
                        href={href}
                        className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition ${
                          isActive
                            ? "bg-pine/10 font-semibold text-pine"
                            : "text-ink hover:bg-black/5 hover:text-pine"
                        }`}
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-40" />
                        {entry.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-black/8 px-5 py-3">
          <Link
            href="/albums"
            className="font-mono text-xs text-dusk transition hover:text-pine"
          >
            View all albums →
          </Link>
        </div>
      </div>
    </>
  );
}
