import { EmptyState } from "@/components/empty-state";
import { PhotoCard } from "@/components/photo-card";
import { searchPublicAssets } from "@/lib/portfolio";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const results = q ? await searchPublicAssets(q) : [];

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-black/10 bg-white/60 px-6 py-8 shadow-soft">
        <p className="text-xs uppercase tracking-[0.35em] text-dusk">Search</p>
        <h1 className="display-font mt-3 text-5xl text-ink">Public smart search</h1>
        <p className="mt-4 max-w-2xl text-sm leading-8 text-dusk md:text-base">
          Search runs against Immich, then the results are filtered back down to only the
          photos that are actually public on the portfolio.
        </p>
      </section>

      {!q ? (
        <EmptyState
          eyebrow="No Query Yet"
          title="Try a place, subject, or camera"
          body="Search is powered by the Immich backend, but the portfolio only returns items that have been curated for public viewing."
        />
      ) : results.length ? (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-dusk">
              Showing {results.length} public result{results.length === 1 ? "" : "s"} for{" "}
              <span className="font-semibold text-ink">{q}</span>
            </p>
          </div>
          <div className="masonry-grid">
            {results.map((result) => (
              <PhotoCard key={result.assetId} asset={result.asset} />
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          eyebrow="No Matches"
          title="Nothing public matched that search"
          body="Immich may know about private matches in the archive, but only explicitly public images can appear here."
        />
      )}
    </div>
  );
}
