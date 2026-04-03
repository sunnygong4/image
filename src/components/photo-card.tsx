"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import type { PublicAsset } from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface PhotoCardProps {
  asset: PublicAsset;
}

export function PhotoCard({ asset }: PhotoCardProps) {
  const [zoomed, setZoomed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const w = asset.exifInfo?.imageWidth;
  const h = asset.exifInfo?.imageHeight;
  const aspectRatio = w && h ? `${w} / ${h}` : "4 / 5";
  const isLandscape = w && h ? w >= h : false;
  // Landscape gets a wider zoom; portrait gets a taller zoom
  const zoomScale = isLandscape ? 1.8 : 1.55;

  function handleEnter() {
    timerRef.current = setTimeout(() => setZoomed(true), 350);
  }

  function handleLeave() {
    clearTimeout(timerRef.current);
    setZoomed(false);
  }

  return (
    <div
      className="masonry-item"
      style={{ position: "relative", zIndex: zoomed ? 50 : undefined }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <Link
        href={`/photos/${asset.id}`}
        className="group block overflow-hidden rounded-md"
        style={{
          display: "block",
          transform: zoomed ? `scale(${zoomScale})` : "scale(1)",
          transition:
            "transform 200ms cubic-bezier(0.34, 1.4, 0.64, 1), box-shadow 200ms ease-out",
          boxShadow: zoomed
            ? "0 24px 64px rgba(0,0,0,0.55)"
            : "0 0 0 rgba(0,0,0,0)",
        }}
      >
        <div
          className="relative overflow-hidden bg-ink/10"
          style={{ aspectRatio }}
        >
          <img
            src={asset.previewUrl}
            alt={asset.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-2.5 text-white">
            <p className="display-font truncate text-base leading-tight">{asset.title}</p>
            <p className="mt-0.5 text-[9px] uppercase tracking-[0.28em] text-white/65">
              {formatDate(asset.captureAt)}
            </p>
          </div>
        </div>
      </Link>
    </div>
  );
}
