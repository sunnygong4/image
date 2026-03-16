import Link from "next/link";

import {
  CONTACT_AVAILABILITY_NOTE,
  CONTACT_BRANDED_EMAIL,
  CONTACT_EMAIL,
  CONTACT_EMAIL_HREF,
  CONTACT_INSTAGRAM_LABEL,
  CONTACT_INSTAGRAM_URL,
  CONTACT_LOCATION,
  CONTACT_PAGE_INTRO,
  CONTACT_PHONE_DISPLAY,
  CONTACT_PHONE_HREF,
  CONTACT_RESPONSE_NOTE,
  SITE_TITLE,
} from "@/lib/site-content";

export const dynamic = "force-dynamic";

const hasInstagram = CONTACT_INSTAGRAM_URL.trim().length > 0;

export default function ContactPage() {
  return (
    <div className="space-y-8">
      <section className="surface-strong overflow-hidden rounded-[2.4rem] border border-black/10 shadow-soft">
        <div className="grid gap-0 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="space-y-6 p-6 md:p-8 lg:p-10">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.35em] text-dusk">Contact</p>
              <h1 className="display-font text-[3.2rem] leading-[0.94] text-ink md:text-[4.4rem]">
                Let&apos;s make something worth remembering.
              </h1>
              <p className="max-w-3xl text-sm leading-8 text-dusk md:text-base">
                {CONTACT_PAGE_INTRO}
              </p>
            </div>

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
                detail="Available for direct inquiries and follow-up conversations."
              />
            </div>

            <div className="rounded-[1.7rem] border border-black/10 bg-white/72 px-5 py-5">
              <p className="text-xs uppercase tracking-[0.3em] text-dusk">Based in</p>
              <p className="display-font mt-3 text-3xl leading-none text-ink md:text-[2.5rem]">
                {CONTACT_LOCATION}
              </p>
              <p className="mt-4 text-sm leading-7 text-dusk md:text-base">
                {CONTACT_AVAILABILITY_NOTE}
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-between bg-[linear-gradient(145deg,_#173336_0%,_#2d5054_42%,_#c5a07b_100%)] p-6 text-white md:p-8 lg:p-10">
            <div className="space-y-6">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/72">
                  Working together
                </p>
                <p className="mt-4 max-w-xl text-sm leading-8 text-white/88 md:text-base">
                  {CONTACT_RESPONSE_NOTE}
                </p>
              </div>

              <div className="rounded-[1.8rem] border border-white/16 bg-white/10 p-5 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.35em] text-white/68">
                  Preferred contact
                </p>
                <div className="mt-4 space-y-3 text-sm leading-7 text-white/88 md:text-base">
                  <p>
                    Email:
                    {" "}
                    <a
                      href={CONTACT_EMAIL_HREF}
                      className="font-semibold text-white transition hover:text-white/78"
                    >
                      {CONTACT_EMAIL}
                    </a>
                  </p>
                  <p>
                    Phone:
                    {" "}
                    <a
                      href={CONTACT_PHONE_HREF}
                      className="font-semibold text-white transition hover:text-white/78"
                    >
                      {CONTACT_PHONE_DISPLAY}
                    </a>
                  </p>
                </div>
              </div>

              {hasInstagram ? (
                <div className="rounded-[1.8rem] border border-white/16 bg-white/10 p-5 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.35em] text-white/68">
                    Elsewhere
                  </p>
                  <a
                    href={CONTACT_INSTAGRAM_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center rounded-full border border-white/22 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white hover:text-ink"
                  >
                    {CONTACT_INSTAGRAM_LABEL}
                  </a>
                </div>
              ) : null}
            </div>

            <div className="mt-8 space-y-4 rounded-[1.8rem] border border-white/16 bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.35em] text-white/68">
                Domain email plan
              </p>
              <p className="text-sm leading-7 text-white/84 md:text-base">
                A branded mailbox can switch the public contact address to
                {" "}
                <span className="font-semibold text-white">{CONTACT_BRANDED_EMAIL}</span>
                {" "}
                once Google Workspace and DNS are verified.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/"
                  className="rounded-full border border-white/22 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white hover:text-ink"
                >
                  Back home
                </Link>
                <Link
                  href="/work/landscape"
                  className="rounded-full border border-white/22 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white hover:text-ink"
                >
                  View work
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="surface-strong rounded-[2rem] border border-black/10 px-6 py-7 shadow-soft md:px-8">
        <p className="text-xs uppercase tracking-[0.35em] text-dusk">About</p>
        <h2 className="display-font mt-3 text-4xl text-ink">{SITE_TITLE}</h2>
        <p className="mt-4 max-w-3xl text-sm leading-8 text-dusk md:text-base">
          Built as a quiet, image-first portfolio where the strongest photographs
          stay front and center while each body of work has room to breathe.
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
      className="rounded-[1.6rem] border border-black/10 bg-[rgba(255,255,255,0.82)] px-5 py-5 transition hover:-translate-y-0.5 hover:border-pine/25"
    >
      <p className="text-xs uppercase tracking-[0.3em] text-dusk">{eyebrow}</p>
      <p className="display-font mt-3 text-[2rem] leading-none text-ink md:text-[2.2rem]">
        {label}
      </p>
      <p className="mt-4 text-sm leading-7 text-dusk">{detail}</p>
    </a>
  );
}
