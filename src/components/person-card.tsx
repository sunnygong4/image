import Link from "next/link";

import type { PublicPersonSummary } from "@/lib/types";
import { pluralize } from "@/lib/utils";

interface PersonCardProps {
  person: PublicPersonSummary;
}

export function PersonCard({ person }: PersonCardProps) {
  return (
    <Link
      href={person.href}
      className="group surface block overflow-hidden rounded-4xl border border-black/10 shadow-soft transition hover:-translate-y-1 hover:border-pine/30"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-ink/10">
        {person.coverAssetId ? (
          <img
            src={`/api/media/${person.coverAssetId}/thumb?size=preview`}
            alt={person.displayName}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-end bg-gradient-to-br from-pine/25 via-amber-100 to-white p-6">
            <span className="display-font text-4xl text-ink">{person.displayName}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
          <p className="text-xs uppercase tracking-[0.32em] text-white/72">People</p>
          <h3 className="display-font mt-2 text-3xl">{person.displayName}</h3>
          <p className="mt-2 text-sm text-white/85">
            {pluralize(person.assetCount, "photo")}
          </p>
        </div>
      </div>
    </Link>
  );
}
