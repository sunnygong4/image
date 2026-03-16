import Link from "next/link";

import type { PublicAlbum } from "@/lib/types";
import { pluralize } from "@/lib/utils";

interface AlbumCardProps {
  album: PublicAlbum;
}

export function AlbumCard({ album }: AlbumCardProps) {
  return (
    <Link
      href={`/albums/${album.slug}`}
      className="group surface block overflow-hidden rounded-4xl border border-black/10 shadow-soft transition hover:-translate-y-1 hover:border-pine/30"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-ink/10">
        {album.coverAssetId ? (
          <img
            src={`/api/media/${album.coverAssetId}/thumb?size=preview`}
            alt={album.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-end bg-gradient-to-br from-pine/30 via-amber-100 to-white p-6">
            <span className="display-font text-4xl text-ink">{album.title}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.32em] text-white/70">
            <span>{album.featured ? "Featured" : "Portfolio Album"}</span>
          </div>
          <h3 className="display-font text-3xl">{album.title}</h3>
          <p className="mt-2 text-sm text-white/85">
            {pluralize(album.assetCount, "photo")}
          </p>
        </div>
      </div>
      <div className="px-5 pb-5 pt-4">
        <p className="line-clamp-3 text-sm leading-7 text-dusk">
          {album.description || "A curated album pulled from the public side of the archive."}
        </p>
      </div>
    </Link>
  );
}

