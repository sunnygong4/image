import { notFound } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { PhotoCard } from "@/components/photo-card";
import { getPublicAlbumBySlug } from "@/lib/portfolio";
import { pluralize } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AlbumPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const album = await getPublicAlbumBySlug(slug);

  if (!album) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-black/10 bg-white/60 shadow-soft">
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="aspect-[4/3] bg-ink/10">
            {album.coverAssetId ? (
              <img
                src={`/api/media/${album.coverAssetId}/thumb?size=preview`}
                alt={album.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-end bg-gradient-to-br from-pine/30 via-amber-100 to-white p-8">
                <span className="display-font text-5xl text-ink">{album.title}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col justify-end p-6 md:p-8">
            <p className="text-xs uppercase tracking-[0.35em] text-dusk">Album</p>
            <h1 className="display-font mt-3 text-4xl text-ink md:text-5xl">{album.title}</h1>
            <p className="mt-4 text-sm leading-8 text-dusk md:text-base">
              {album.description || "A curated album selected from the public side of the archive."}
            </p>
            <p className="mt-6 text-sm font-semibold text-pine">
              {pluralize(album.assetCount, "photo")}
            </p>
          </div>
        </div>
      </section>

      {album.assets?.length ? (
        <section className="masonry-grid">
          {album.assets.map((asset) => (
            <PhotoCard key={asset.id} asset={asset} />
          ))}
        </section>
      ) : (
        <EmptyState
          eyebrow="No Photos"
          title="This album does not have public images yet"
          body="The album exists, but every photo in it is currently private or waiting for visibility overrides."
        />
      )}
    </div>
  );
}
