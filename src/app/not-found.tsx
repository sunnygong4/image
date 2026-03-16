import Link from "next/link";

import { EmptyState } from "@/components/empty-state";

export default function NotFound() {
  return (
    <EmptyState
      eyebrow="Not Found"
      title="That page is not public"
      body="The album or photo you requested is either private, has moved, or has not been curated for the public portfolio."
      action={
        <Link
          href="/"
          className="inline-flex rounded-full bg-pine px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink"
        >
          Return to the portfolio
        </Link>
      }
    />
  );
}

