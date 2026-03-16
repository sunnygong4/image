"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { HOME_NAV_LINKS, SITE_TITLE } from "@/lib/site-content";

export function SiteHeader() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  return (
    <header className="site-header surface-strong sticky top-3 z-30 mb-4 rounded-[1.75rem] border border-black/10 px-4 py-3 shadow-soft md:mb-5 md:px-5">
      <div className="flex items-start justify-between gap-4 md:items-center">
        <Link href="/" className="inline-flex flex-col">
          <span className="display-font text-[1.82rem] leading-[0.92] text-ink sm:hidden">
            Sunny Gong
          </span>
          <span className="display-font text-[1.82rem] leading-[0.92] text-ink sm:hidden">
            Photography
          </span>
          <span className="display-font hidden text-[2.2rem] leading-none text-ink sm:inline md:text-[2.6rem]">
            {SITE_TITLE}
          </span>
        </Link>

        <button
          type="button"
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          onClick={() => setIsMenuOpen((current) => !current)}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white/78 text-ink transition hover:border-pine/30 hover:text-pine md:hidden"
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

        <nav className="hidden items-center gap-2 text-sm font-medium text-dusk md:flex md:flex-wrap md:justify-end">
          {HOME_NAV_LINKS.map((link) => (
            <HeaderLink
              key={link.href}
              href={link.href}
              label={link.label}
              pathname={pathname}
            />
          ))}
        </nav>
      </div>

      <div
        className={`grid transition-[grid-template-rows,opacity,margin] duration-300 md:hidden ${
          isMenuOpen ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="rounded-[1.45rem] border border-black/10 bg-white/72 p-3 shadow-soft">
            <p className="text-[10px] uppercase tracking-[0.3em] text-dusk">Menu</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {HOME_NAV_LINKS.map((link) => (
                <HeaderLink
                  key={link.href}
                  href={link.href}
                  label={link.label}
                  pathname={pathname}
                  mobile
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function HeaderLink({
  href,
  label,
  mobile = false,
  pathname,
}: {
  href: string;
  label: string;
  mobile?: boolean;
  pathname: string;
}) {
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-full border px-3 py-2 text-center transition ${
        isActive
          ? "border-pine/40 bg-pine text-white"
          : "border-black/10 bg-white/78 text-dusk hover:border-pine/30 hover:text-pine"
      } ${mobile ? "min-h-11 text-sm font-medium" : "text-sm font-medium"}`}
    >
      {label}
    </Link>
  );
}
