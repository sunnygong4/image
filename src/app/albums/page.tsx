import { AlbumCard } from "@/components/album-card";
import { EmptyState } from "@/components/empty-state";
import { getPublicAlbums } from "@/lib/portfolio";

export const dynamic = "force-dynamic";

export default async function AlbumsPage() {
  const albums = await getPublicAlbums();

  if (!albums.length) {
    return (
      <EmptyState
        eyebrow="Albums"
        title="Nothing is public yet"
        body="The public site only shows synced Immich albums. If your photos are only in the Immich timeline, put them in an album first, then sync and mark that album public in the admin area."
      />
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-black/10 bg-white/60 px-6 py-8 shadow-soft">
        <p className="text-xs uppercase tracking-[0.35em] text-dusk">Albums</p>
        <h1 className="display-font mt-3 text-5xl text-ink">Public collections</h1>
        <p className="mt-4 max-w-2xl text-sm leading-8 text-dusk md:text-base">
          Albums are curated independently from the archive, so the public site can stay
          tidy even while the private library continues to grow.
        </p>
      </section>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {albums.map((album) => (
          <AlbumCard key={album.id} album={album} />
        ))}
      </div>
    </div>
  );
}
