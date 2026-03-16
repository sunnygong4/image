import { notFound } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { PhotoCard } from "@/components/photo-card";
import { GENRE_CONTENT, isPortfolioGenre } from "@/lib/catalog";
import { getPublicAssetsByGenre } from "@/lib/portfolio";

export const dynamic = "force-dynamic";

export default async function WorkGenrePage({
  params,
}: {
  params: Promise<{ genre: string }>;
}) {
  const { genre } = await params;

  if (!isPortfolioGenre(genre)) {
    notFound();
  }

  const assets = await getPublicAssetsByGenre(genre);

  if (!assets.length) {
    return (
      <EmptyState
        eyebrow={GENRE_CONTENT[genre].kicker}
        title={`${GENRE_CONTENT[genre].title} is still being curated`}
        body="Mark images as approved and assign this genre in the admin area to populate the gallery."
      />
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-black/10 bg-white/70 px-6 py-8 shadow-soft">
        <p className="text-xs uppercase tracking-[0.35em] text-dusk">
          {GENRE_CONTENT[genre].kicker}
        </p>
        <h1 className="display-font mt-3 text-5xl text-ink">
          {GENRE_CONTENT[genre].title}
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-8 text-dusk md:text-base">
          {GENRE_CONTENT[genre].description}
        </p>
      </section>

      <section className="masonry-grid">
        {assets.map((asset) => (
          <PhotoCard key={asset.id} asset={asset} />
        ))}
      </section>
    </div>
  );
}
