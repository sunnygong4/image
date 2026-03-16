import { EmptyState } from "@/components/empty-state";
import { PersonCard } from "@/components/person-card";
import { getPublicPeople } from "@/lib/portfolio";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const people = await getPublicPeople();

  if (!people.length) {
    return (
      <EmptyState
        eyebrow="People"
        title="No public people are available yet"
        body="Import Lightroom people and sync Immich suggestions to build public person pages for the portfolio."
      />
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-black/10 bg-white/70 px-6 py-8 shadow-soft">
        <p className="text-xs uppercase tracking-[0.35em] text-dusk">People</p>
        <h1 className="display-font mt-3 text-5xl text-ink">Public person index</h1>
        <p className="mt-4 max-w-3xl text-sm leading-8 text-dusk md:text-base">
          Confirmed people from Lightroom and Immich can now become public discovery
          pages without exposing the private archive itself.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {people.map((person) => (
          <PersonCard key={person.id} person={person} />
        ))}
      </section>
    </div>
  );
}
