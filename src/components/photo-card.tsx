import Link from "next/link";

import type { PublicAsset } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { GENRE_CONTENT } from "@/lib/catalog";

interface PhotoCardProps {
  asset: PublicAsset;
}

export function PhotoCard({ asset }: PhotoCardProps) {
  const ratio =
    asset.exifInfo?.imageWidth && asset.exifInfo?.imageHeight
      ? `${asset.exifInfo.imageWidth} / ${asset.exifInfo.imageHeight}`
      : undefined;

  return (
    <div className="masonry-item">
      <Link
        href={`/photos/${asset.id}`}
        className="group surface block overflow-hidden rounded-[1.75rem] border border-black/10 shadow-soft transition hover:-translate-y-1 hover:border-pine/30"
      >
        <div
          className="relative overflow-hidden bg-ink/10"
          style={ratio ? { aspectRatio: ratio } : { aspectRatio: "4 / 5" }}
        >
          <img
            src={asset.previewUrl}
            alt={asset.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-90" />
          <div className="absolute inset-x-0 bottom-0 p-4 text-white">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="display-font text-2xl leading-none">{asset.title}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.28em] text-white/70">
                  {formatDate(asset.captureAt)}
                </p>
                {asset.primaryGenre ? (
                  <p className="mt-2 text-[10px] uppercase tracking-[0.28em] text-white/62">
                    {GENRE_CONTENT[asset.primaryGenre].title}
                  </p>
                ) : null}
              </div>
              {asset.featured ? (
                <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-white/80">
                  Featured
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
