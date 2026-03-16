import { notFound } from "next/navigation";

import { PhotoViewer } from "@/components/photo-viewer";
import { getPublicAlbumBySlug, getPublicAssetById } from "@/lib/portfolio";

export const dynamic = "force-dynamic";

export default async function PhotoPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = await params;
  const asset = await getPublicAssetById(assetId);

  if (!asset) {
    notFound();
  }

  const primaryAlbumSlug = asset.publicAlbumSlugs[0] ?? null;
  const album = primaryAlbumSlug
    ? await getPublicAlbumBySlug(primaryAlbumSlug).catch(() => null)
    : null;
  const currentIndex =
    album?.assets?.findIndex((candidate) => candidate.id === asset.id) ?? -1;
  const previousAsset =
    currentIndex > 0 && album?.assets ? album.assets[currentIndex - 1] : null;
  const nextAsset =
    currentIndex >= 0 && album?.assets && currentIndex < album.assets.length - 1
      ? album.assets[currentIndex + 1]
      : null;

  return (
    <PhotoViewer
      asset={asset}
      fullsizeUrl={`/api/media/${asset.id}/thumb?size=fullsize`}
      navigation={{
        albumTitle: album?.title ?? null,
        backHref: album ? `/albums/${album.slug}` : "/albums",
        previous: previousAsset
          ? {
              href: `/photos/${previousAsset.id}`,
              title: previousAsset.title,
            }
          : null,
        next: nextAsset
          ? {
              href: `/photos/${nextAsset.id}`,
              title: nextAsset.title,
            }
          : null,
        positionLabel:
          album?.assets && currentIndex >= 0
            ? `${currentIndex + 1} / ${album.assets.length}`
            : null,
        stripItems:
          album?.assets?.map((item) => ({
            active: item.id === asset.id,
            href: `/photos/${item.id}`,
            id: item.id,
            thumbUrl: item.thumbUrl,
            title: item.title,
          })) ?? [],
      }}
    />
  );
}
