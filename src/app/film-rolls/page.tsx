import { AlbumCard } from "@/components/album-card";
import { EmptyState } from "@/components/empty-state";
import { getFilmRollAlbums } from "@/lib/portfolio";

export const dynamic = "force-dynamic";

export default async function FilmRollsPage() {
  let albums: Awaited<ReturnType<typeof getFilmRollAlbums>> = [];

  try {
    albums = await getFilmRollAlbums();
  } catch {
    // DB not yet initialised or migration pending — show empty state
  }

  if (!albums.length) {
    return (
      <EmptyState
        eyebrow="Film Rolls"
        title="No film rolls yet"
        body="Mark albums as Film Roll in the admin area to have them appear here, then run a sync."
      />
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-black/10 bg-white/60 px-6 py-8 shadow-soft">
        <p className="text-xs uppercase tracking-[0.35em] text-dusk">Film</p>
        <h1 className="display-font mt-3 text-5xl text-ink">Film rolls</h1>
        <p className="mt-4 max-w-2xl text-sm leading-8 text-dusk md:text-base">
          Scans from analogue rolls — each album is a single roll of film, shot on 35mm or medium format.
        </p>
      </section>

      <div className="grid grid-cols-3 gap-3 lg:grid-cols-5">
        {albums.map((album) => (
          <AlbumCard key={album.id} album={album} />
        ))}
      </div>
    </div>
  );
}
