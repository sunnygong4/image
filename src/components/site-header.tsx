"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
  CROSS_SITE_NAV_LINKS,
  HOME_NAV_LINKS,
  MAIN_SITE_URL,
} from "@/lib/site-content";

const GALLERY_LINKS = HOME_NAV_LINKS.filter((l) => l.href !== "/");
const SITE_LINKS = CROSS_SITE_NAV_LINKS;

export function SiteHeader() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSiteMode, setIsSiteMode] = useState(false);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  return (
    <header
      className={`site-header fixed inset-x-0 top-0 z-30 border-b backdrop-blur-[14px] transition-all duration-300 ${
        isSiteMode
          ? "border-white/8 bg-[rgba(25,39,60,0.82)]"
          : "border-black/8 bg-white/88"
      }`}
      onMouseLeave={() => setIsSiteMode(false)}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-[0.9rem] md:px-6">
        {/* Logo — hover activates site mode for the whole header */}
        <a
          href={MAIN_SITE_URL}
          className="logo-zone inline-flex shrink-0"
          onMouseEnter={() => setIsSiteMode(true)}
        >
          <img
            src="/logo-wordmark.png"
            alt="Sunny Gong"
            className={`h-auto max-h-10 w-auto transition-[filter] duration-300 md:max-h-16 ${
              isSiteMode ? "brightness-0 invert" : ""
            }`}
          />
        </a>

        {/* Mobile hamburger */}
        <button
          type="button"
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          onClick={() => setIsMenuOpen((current) => !current)}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white/78 text-ink transition duration-300 hover:border-pine/30 hover:text-pine md:hidden"
        >
          <span className="relative h-4 w-5">
            <span
              className={`absolute left-0 top-0 h-[1.5px] w-5 rounded-full bg-current transition ${
                isMenuOpen ? "translate-y-[7px] rotate-45" : ""
              }`}
            />
            <span
              className={`absolute left-0 top-[7px] h-[1.5px] w-5 rounded-full bg-current transition ${
                isMenuOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`absolute left-0 top-[14px] h-[1.5px] w-5 rounded-full bg-current transition ${
                isMenuOpen ? "-translate-y-[7px] -rotate-45" : ""
              }`}
            />
          </span>
        </button>

        {/* Desktop nav — gallery links by default, site links when logo is hovered */}
        <div className="relative hidden md:flex items-center">
          {/* Gallery Home link */}
          <Link
            href="/"
            className={`whitespace-nowrap rounded-full px-[0.92rem] py-[0.58rem] font-mono text-[0.95rem] transition-all duration-300 ${
              isSiteMode ? "opacity-0 pointer-events-none" : ""
            } ${
              pathname === "/"
                ? "bg-pine/14 text-pine"
                : "text-dusk hover:bg-black/5 hover:text-ink"
            }`}
          >
            Gallery Home
          </Link>

          {/* Gallery links (default) */}
          <nav className={`flex items-center gap-[0.5rem] transition-all duration-300 ${
            isSiteMode ? "opacity-0 pointer-events-none" : ""
          }`}>
            {GALLERY_LINKS.map((link) => {
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`whitespace-nowrap rounded-full px-[0.92rem] py-[0.58rem] font-mono text-[0.95rem] transition-all duration-300 ${
                    isActive
                      ? "bg-pine/14 text-pine"
                      : "text-dusk hover:bg-black/5 hover:text-ink"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Site links (on logo hover) — overlaid on top */}
          <nav className={`absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-[0.5rem] transition-all duration-300 ${
            isSiteMode ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}>
            {SITE_LINKS.map((link) => {
              const isInternal = link.href.startsWith("/");
              const isGallery = link.label === "Gallery";
              const Tag = isInternal ? Link : "a";

              return (
                <Tag
                  key={link.href}
                  href={link.href}
                  className={`whitespace-nowrap rounded-full px-[0.92rem] py-[0.58rem] font-mono text-[0.95rem] transition-all duration-300 ${
                    isGallery
                      ? "bg-[rgba(139,92,246,0.18)] text-[#f8fafc]"
                      : "text-[#c9d5e6] hover:bg-[rgba(139,92,246,0.18)] hover:text-[#f8fafc]"
                  }`}
                >
                  {link.label}
                </Tag>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Mobile menu — gallery links only */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 md:hidden ${
          isMenuOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="mx-auto max-w-7xl px-4 pb-4">
            <div className="rounded-[1.45rem] border border-black/10 bg-white/72 p-3 shadow-soft">
              <p className="text-[10px] uppercase tracking-[0.3em] text-dusk">
                Gallery
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {GALLERY_LINKS.map((link) => {
                  const isActive = pathname.startsWith(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`inline-flex items-center justify-center rounded-full border min-h-11 px-3 py-2 text-center text-sm font-medium transition ${
                        isActive
                          ? "border-pine/40 bg-pine text-white"
                          : "border-black/10 bg-white/78 text-dusk hover:border-pine/30 hover:text-pine"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
