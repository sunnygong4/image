import { AlbumGrid } from "@/components/album-grid";
import { PhotoCard } from "@/components/photo-card";
import { getHomePageData } from "@/lib/portfolio";
import {
  HERO_PORTRAIT_ALT,
  HERO_PORTRAIT_SRC,
  HOME_HERO_DETAILS,
  HOME_INTRO,
  HOME_ROLE_LINE,
} from "@/lib/site-content";
import type { HomePageData } from "@/lib/types";

const SIGNATURE_SECTION_ID = "signature-work";
const HOME_DATA_TIMEOUT_MS = 8000;

const PREVIEW_SIGNATURES = [
  {
    description: "Broad skies, quiet terrain, and light that slows the page down.",
    title: "Landscape studies",
    tone: "from-[#2d4d57] via-[#46645b] to-[#8c8664]",
  },
  {
    description: "Animal portraits and field moments built around patience and distance.",
    title: "Wildlife moments",
    tone: "from-[#596c47] via-[#7d8461] to-[#9a7d55]",
  },
  {
    description: "Daily-life frames, city texture, and the smaller observations in between.",
    title: "Street and daily life",
    tone: "from-[#384656] via-[#54616e] to-[#7b8792]",
  },
] as const;

const EMPTY_HOME_DATA: HomePageData = {
  featuredAlbums: [],
  monthAlbums: [],
  filmRollAlbums: [],
  featuredPeople: [],
  signatureAssets: [],
  specialtySections: [],
};

export default async function HomePage() {
  const { data, previewMode } = await loadHomePage();
  const hasLiveSignatureAssets = data.signatureAssets.length > 0;

  return (
    <div className="space-y-7 md:space-y-10">
      <section className="surface-strong hidden overflow-hidden rounded-[2rem] border border-black/10 shadow-soft md:block">
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.06fr)_minmax(19rem,0.94fr)] lg:gap-8 lg:p-8">
          <div className="flex min-h-[34rem] flex-col justify-between rounded-[1.75rem] bg-white/38 p-7 lg:p-9">
            <div className="max-w-3xl">
              <p className="text-[11px] uppercase tracking-[0.34em] text-dusk">
                About me
              </p>
              <h1 className="display-font mt-4 text-[4.5rem] leading-[0.9] text-ink lg:text-[5.5rem]">
                Sunny Gong
              </h1>
              <p className="mt-4 max-w-2xl text-xl leading-relaxed text-dusk">
                {HOME_ROLE_LINE}
              </p>
              <div className="mt-8 max-w-2xl space-y-4 text-[1.05rem] leading-8 text-dusk">
                {HOME_INTRO.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </div>

            <div className="mt-8">
              <p className="max-w-md text-xs uppercase tracking-[0.3em] text-dusk/88">
                {HOME_HERO_DETAILS.join(" / ")}
              </p>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[1.75rem]">
            <div className="absolute right-5 top-5 z-10 rounded-full border border-white/25 bg-black/28 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-white/80 backdrop-blur">
              {previewMode ? "Local preview" : "Portrait / About"}
            </div>
            <div className="aspect-[4/5] h-full min-h-[34rem]">
              <img
                src={HERO_PORTRAIT_SRC}
                alt={HERO_PORTRAIT_ALT}
                className="h-full w-full object-cover object-center"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/58 via-black/8 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-7 text-white lg:p-8">
              <p className="text-[11px] uppercase tracking-[0.34em] text-white/72">
                Waterloo / Coquitlam
              </p>
              <p className="mt-2 max-w-sm text-sm leading-7 text-white/82">
                Landscapes, wildlife, daily life, and selected events.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="surface-strong overflow-hidden rounded-[2rem] border border-black/10 shadow-soft md:hidden">
        <div className="relative overflow-hidden">
          <div className="aspect-[4/5] sm:aspect-[16/11] lg:aspect-[16/8.4]">
            <img
              src={HERO_PORTRAIT_SRC}
              alt={HERO_PORTRAIT_ALT}
              className="h-full w-full object-cover object-center"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/18 to-transparent" />
          <div className="absolute right-4 top-4 rounded-full border border-white/25 bg-black/28 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-white/80 backdrop-blur md:right-6 md:top-6">
            {previewMode ? "Local preview" : "Portrait / About"}
          </div>
          <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7 lg:p-10">
            <div className="max-w-3xl">
              <p className="text-[11px] uppercase tracking-[0.34em] text-white/70">
                About me
              </p>
              <h1 className="display-font mt-3 text-[3rem] leading-[0.88] sm:text-[4rem] lg:text-[5.4rem]">
                Sunny Gong
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/84 sm:text-lg">
                {HOME_ROLE_LINE}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 px-5 py-6 sm:px-7 sm:py-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(15rem,0.8fr)] lg:gap-10 lg:px-10 lg:py-9">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.34em] text-dusk">Biography</p>
            <div className="mt-3 space-y-4 text-base leading-8 text-dusk sm:text-[1.08rem]">
              {HOME_INTRO.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-between gap-5 lg:items-end">
            <p className="max-w-md text-sm uppercase tracking-[0.28em] text-dusk/88 lg:text-right">
              {HOME_HERO_DETAILS.join(" / ")}
            </p>
          </div>
        </div>
      </section>

      <section id={SIGNATURE_SECTION_ID} className="scroll-mt-28">
        <div className="surface-strong overflow-hidden rounded-[2rem] border border-black/10 shadow-soft">
          {hasLiveSignatureAssets ? (
            <div className="masonry-grid p-5 sm:p-6">
              {data.signatureAssets.map((asset) => (
                <PhotoCard key={asset.id} asset={asset} />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-3">
              {PREVIEW_SIGNATURES.map((item) => (
                <article
                  key={item.title}
                  className="relative overflow-hidden rounded-[1.75rem] p-5 sm:p-6"
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${item.tone} opacity-[0.92]`}
                  />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_35%)]" />
                  <div className="relative flex min-h-[19rem] flex-col justify-end text-white">
                    <p className="text-[11px] uppercase tracking-[0.34em] text-white/72">
                      Portfolio preview
                    </p>
                    <h3 className="display-font mt-2 text-[2.2rem] leading-none">
                      {item.title}
                    </h3>
                    <p className="mt-3 max-w-sm text-sm leading-7 text-white/82">
                      {item.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <AlbumGrid albums={data.featuredAlbums} title="Events" />
      {data.monthAlbums.length > 0 && (
        <AlbumGrid albums={data.monthAlbums} title="Monthly archives" />
      )}
      {data.filmRollAlbums.length > 0 && (
        <AlbumGrid albums={data.filmRollAlbums} title="Film rolls" />
      )}
    </div>
  );
}

async function loadHomePage() {
  try {
    return await Promise.race([
      getHomePageData().then((data) => ({
        data,
        previewMode: false,
      })),
      new Promise<{ data: HomePageData; previewMode: true }>((resolve) => {
        setTimeout(() => {
          resolve({
            data: EMPTY_HOME_DATA,
            previewMode: true,
          });
        }, HOME_DATA_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return {
      data: EMPTY_HOME_DATA,
      previewMode: true,
    };
  }
}
