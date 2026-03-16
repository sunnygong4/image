import { notFound } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { PhotoCard } from "@/components/photo-card";
import { getPublicPersonBySlug } from "@/lib/portfolio";
import { pluralize } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PersonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const detail = await getPublicPersonBySlug(slug);

  if (!detail) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-black/10 bg-white/70 shadow-soft">
        <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="aspect-[4/3] bg-ink/10">
            {detail.person.coverAssetId ? (
              <img
                src={`/api/media/${detail.person.coverAssetId}/thumb?size=fullsize`}
                alt={detail.person.displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-end bg-gradient-to-br from-pine/25 via-amber-100 to-white p-8">
                <span className="display-font text-5xl text-ink">
                  {detail.person.displayName}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col justify-end p-6 md:p-8">
            <p className="text-xs uppercase tracking-[0.35em] text-dusk">People</p>
            <h1 className="display-font mt-3 text-4xl text-ink md:text-5xl">
              {detail.person.displayName}
            </h1>
            <p className="mt-4 text-sm leading-8 text-dusk md:text-base">
              A public collection of approved images linked to this person across the
              curated side of the archive.
            </p>
            <p className="mt-6 text-sm font-semibold text-pine">
              {pluralize(detail.person.assetCount, "photo")}
            </p>
          </div>
        </div>
      </section>

      {detail.assets.length ? (
        <section className="masonry-grid">
          {detail.assets.map((asset) => (
            <PhotoCard key={asset.id} asset={asset} />
          ))}
        </section>
      ) : (
        <EmptyState
          eyebrow="No Photos"
          title="This person does not have public photos yet"
          body="Person metadata exists, but none of the linked assets are public and approved right now."
        />
      )}
    </div>
  );
}
