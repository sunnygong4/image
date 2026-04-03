"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ScrollRestorer() {
  const pathname = usePathname();

  // Save scroll on every internal link click — capture phase fires BEFORE
  // React/Next.js handles the event, so window.scrollY is still correct.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as Element).closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      // Only save for internal navigations that change the path
      if (href?.startsWith("/") && href !== pathname) {
        sessionStorage.setItem(`scroll-pos:${pathname}`, String(window.scrollY));
      }
    }
    document.addEventListener("click", handleClick, true /* capture */);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname]);

  // Restore scroll position after the page mounts
  useEffect(() => {
    const key = `scroll-pos:${pathname}`;
    const saved = sessionStorage.getItem(key);
    if (!saved) return;

    const top = parseInt(saved, 10);
    if (!top) return;

    sessionStorage.removeItem(key);

    // Two rAFs ensure at least two render cycles complete (content is painted),
    // then a 250ms retry covers cases where images shift the layout taller.
    let raf1: number, raf2: number, tid: ReturnType<typeof setTimeout>;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        window.scrollTo({ top, behavior: "instant" });
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

  return null;
}
