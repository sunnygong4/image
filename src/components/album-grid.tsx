"use client";

import { useState } from "react";

import { AlbumCard } from "@/components/album-card";
import type { PublicAlbum } from "@/lib/types";

const DEFAULT_SHOW = 9;

export function AlbumGrid({ albums }: { albums: PublicAlbum[] }) {
  const [expanded, setExpanded] = useState(false);

  if (albums.length === 0) return null;

  const visible = expanded ? albums : albums.slice(0, DEFAULT_SHOW);
  const hasMore = albums.length > DEFAULT_SHOW;

  return (
    <section>
      <div className="grid grid-cols-3 gap-3 lg:grid-cols-5">
        {visible.map((album) => (
          <AlbumCard key={album.id} album={album} />
        ))}
      </div>

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/78 px-6 py-3 font-mono text-sm text-dusk transition hover:border-pine/30 hover:text-pine"
          >
            {expanded ? (
              <>
                <span>Show less</span>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 15l-6-6-6 6" />
                </svg>
              </>
            ) : (
              <>
                <span>Show all {albums.length} albums</span>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
}
