import type { ReactNode } from "react";

interface EmptyStateProps {
  eyebrow: string;
  title: string;
  body: string;
  action?: ReactNode;
}

export function EmptyState({
  eyebrow,
  title,
  body,
  action,
}: EmptyStateProps) {
  return (
    <section className="surface rounded-4xl border border-black/10 px-6 py-10 text-center shadow-soft md:px-10">
      <p className="mb-3 text-xs uppercase tracking-[0.35em] text-dusk">{eyebrow}</p>
      <h2 className="display-font text-3xl text-ink md:text-4xl">{title}</h2>
      <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-dusk md:text-base">
        {body}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </section>
  );
}

