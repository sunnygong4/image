import {
  CONTACT_AVAILABILITY_NOTE,
  CONTACT_EMAIL,
  CONTACT_EMAIL_HREF,
  CONTACT_LOCATION,
  CONTACT_PAGE_INTRO,
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_HREF,
} from "@/lib/site-content";

export const dynamic = "force-dynamic";

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="surface-strong rounded-[2rem] border border-black/10 px-6 py-7 shadow-soft md:px-8 md:py-9">
        <p className="text-xs uppercase tracking-[0.35em] text-dusk">Contact</p>
        <h1 className="display-font mt-3 text-[2.8rem] leading-[0.94] text-ink md:text-[3.6rem]">
          Get in touch.
        </h1>
        <p className="mt-4 text-sm leading-8 text-dusk md:text-base">
          {CONTACT_PAGE_INTRO}
        </p>
        <p className="mt-2 text-sm leading-7 text-dusk/70">
          {CONTACT_AVAILABILITY_NOTE}
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <ContactCard
          eyebrow="Email"
          href={CONTACT_EMAIL_HREF}
          label={CONTACT_EMAIL}
          detail="Best for inquiries, collaborations, and print conversations."
        />
        <ContactCard
          eyebrow="Phone"
          href={CONTACT_PHONE_HREF}
          label={CONTACT_PHONE_DISPLAY}
          detail="Available for direct inquiries and follow-ups."
        />
      </div>

      <section className="surface-strong rounded-[2rem] border border-black/10 px-6 py-5 shadow-soft md:px-8">
        <p className="text-xs uppercase tracking-[0.3em] text-dusk">Based in</p>
        <p className="display-font mt-2 text-xl leading-snug text-ink md:text-2xl">
          {CONTACT_LOCATION}
        </p>
      </section>
    </div>
  );
}

function ContactCard({
  detail,
  eyebrow,
  href,
  label,
}: {
  detail: string;
  eyebrow: string;
  href: string;
  label: string;
}) {
  return (
    <a
      href={href}
      className="surface-strong rounded-[1.6rem] border border-black/10 px-5 py-5 shadow-soft transition hover:-translate-y-0.5 hover:border-pine/25"
    >
      <p className="text-xs uppercase tracking-[0.3em] text-dusk">{eyebrow}</p>
      <p className="display-font mt-3 text-[1.6rem] leading-none text-ink md:text-[1.9rem]">
        {label}
      </p>
      <p className="mt-3 text-sm leading-7 text-dusk">{detail}</p>
    </a>
  );
}
