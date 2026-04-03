"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ScrollRestorer() {
  const pathname = usePathname();

  useEffect(() => {
    const key = `scroll-pos:${pathname}`;
    const saved = sessionStorage.getItem(key);

    if (saved !== null) {
      const top = parseInt(saved, 10);
      // Use a small delay so the page has time to render before scrolling
      const id = setTimeout(() => {
        window.scrollTo({ top, behavior: "instant" });
      }, 80);
      return () => clearTimeout(id);
    }
  }, [pathname]);

  useEffect(() => {
    const key = `scroll-pos:${pathname}`;
    return () => {
      // Save scroll position when navigating away from this path
      sessionStorage.setItem(key, String(window.scrollY));
    };
  }, [pathname]);

  return null;
}
