"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ScrollRestorer() {
  const pathname = usePathname();

  useEffect(() => {
    const key = `scroll-pos:${pathname}`;
    const saved = sessionStorage.getItem(key);
    if (saved === null) return;

    const top = parseInt(saved, 10);
    if (!top) return;

    sessionStorage.removeItem(key);

    // force-dynamic pages fetch server content before painting.
    // Two rAFs ensure at least two render cycles have completed,
    // then a short timeout covers slower network/image-driven layout.
    let raf1: number, raf2: number, tid: ReturnType<typeof setTimeout>;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        // First attempt — works if content is already tall enough
        window.scrollTo({ top, behavior: "instant" });
        // Second attempt at 250ms handles cases where images pushed the page taller
        tid = setTimeout(() => {
          window.scrollTo({ top, behavior: "instant" });
        }, 250);
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(tid);
    };
  }, [pathname]);

  useEffect(() => {
    const key = `scroll-pos:${pathname}`;
    return () => {
      // Save scroll position the moment we navigate away
      sessionStorage.setItem(key, String(window.scrollY));
    };
  }, [pathname]);

  return null;
}
