import { getAssetAnnotation } from "@/lib/db";
import { getImmichAlbum, listImmichAlbums } from "@/lib/immich";
import { patchAlbumConfig, patchAssetConfig, syncPortfolioFromImmich } from "@/lib/portfolio";
import type { ImmichAsset, PortfolioGenre, PortfolioRole } from "@/lib/types";

const DEFAULT_ALBUM_NAME = "Temp Export Test";
const SIGNATURE_LIMIT = 12;
const SPECIALTY_LIMIT = 18;
const FEATURED_LIMIT = 8;

interface InferenceResult {
  confidence: number;
  primaryGenre: PortfolioGenre;
  secondaryGenre: PortfolioGenre | null;
}

interface RankedAsset {
  aiScore: number;
  asset: ImmichAsset;
  confidence: number;
  primaryGenre: PortfolioGenre;
  secondaryGenre: PortfolioGenre | null;
}

async function main() {
  const selector = process.argv[2] ?? DEFAULT_ALBUM_NAME;

  await syncPortfolioFromImmich();

  const albumSummary = await findAlbum(selector);
  if (!albumSummary) {
    throw new Error(`Could not find an Immich album matching "${selector}".`);
  }

  const album = await getImmichAlbum(albumSummary.id);
  const rankedAssets = (album.assets ?? [])
    .filter((asset) => asset.type !== "VIDEO")
    .map((asset) => {
      const inference = inferGenre(asset);
      const annotation = getAssetAnnotation(asset.id);

      return {
        aiScore: annotation?.aiScore ?? 0,
        asset,
        confidence: inference.confidence,
        primaryGenre: inference.primaryGenre,
        secondaryGenre: inference.secondaryGenre,
      } satisfies RankedAsset;
    })
    .sort((left, right) => right.aiScore - left.aiScore);

  if (!rankedAssets.length) {
    throw new Error(`Album "${album.albumName}" has no photo assets to promote.`);
  }

  const signatureIds = new Set(selectTopIds(rankedAssets, ["landscape", "wildlife"], SIGNATURE_LIMIT));
  const specialtyIds = new Set(
    selectTopIds(rankedAssets, ["street", "event", "product", "sports"], SPECIALTY_LIMIT),
  );
  const featuredIds = new Set(rankedAssets.slice(0, FEATURED_LIMIT).map((item) => item.asset.id));
  const coverAssetId = rankedAssets[0]?.asset.id ?? album.albumThumbnailAssetId ?? null;

  patchAlbumConfig(album.id, {
    coverAssetId,
    featured: true,
    titleOverride: album.albumName,
    visibility: "public",
  });

  rankedAssets.forEach((item, index) => {
    const portfolioRole = signatureIds.has(item.asset.id)
      ? "signature"
      : specialtyIds.has(item.asset.id)
        ? "specialty"
        : "archive";

    patchAssetConfig(item.asset.id, album.id, {
      featured: featuredIds.has(item.asset.id),
      portfolioRole,
      primaryGenre: item.primaryGenre,
      reviewState: "approved",
      secondaryGenre: item.secondaryGenre,
      sortOrder: index,
      visibility: "inherit",
    });
  });

  const genreCounts = rankedAssets.reduce<Record<string, number>>((counts, item) => {
    counts[item.primaryGenre] = (counts[item.primaryGenre] ?? 0) + 1;
    return counts;
  }, {});

  console.log(
    JSON.stringify(
      {
        albumId: album.id,
        albumName: album.albumName,
        assetCount: rankedAssets.length,
        coverAssetId,
        featuredCount: featuredIds.size,
        genreCounts,
        signatureCount: signatureIds.size,
        specialtyCount: specialtyIds.size,
      },
      null,
      2,
    ),
  );
}

async function findAlbum(selector: string) {
  const trimmed = selector.trim().toLowerCase();
  const albums = await listImmichAlbums();

  return (
    albums.find((album) => album.id === selector) ??
    albums.find((album) => album.albumName.toLowerCase() === trimmed) ??
    albums.find((album) => album.albumName.toLowerCase().includes(trimmed)) ??
    null
  );
}

function selectTopIds(
  items: RankedAsset[],
  genres: PortfolioGenre[],
  limit: number,
) {
  return items
    .filter((item) => genres.includes(item.primaryGenre))
    .slice(0, limit)
    .map((item) => item.asset.id);
}

function inferGenre(asset: ImmichAsset): InferenceResult {
  const fileName = asset.originalFileName.toLowerCase();
  const lens = (asset.exifInfo?.lensModel ?? "").toLowerCase();
  const focalLength = asset.exifInfo?.focalLength ?? 0;
  const iso = asset.exifInfo?.iso ?? 0;
  const peopleCount = asset.people?.length ?? 0;

  if (lens.includes("150-500") || focalLength >= 250) {
    return {
      confidence: 0.9,
      primaryGenre: "wildlife",
      secondaryGenre: focalLength >= 400 ? "landscape" : null,
    };
  }

  if (fileName.includes("hdr") || (focalLength > 0 && focalLength <= 35)) {
    return {
      confidence: 0.78,
      primaryGenre: "landscape",
      secondaryGenre: peopleCount > 0 ? "street" : null,
    };
  }

  if (lens.includes("macro") || (focalLength >= 90 && focalLength <= 120)) {
    return {
      confidence: 0.7,
      primaryGenre: "product",
      secondaryGenre: "other",
    };
  }

  if (peopleCount >= 2 || (iso >= 3200 && focalLength >= 35 && focalLength <= 135)) {
    return {
      confidence: 0.66,
      primaryGenre: "event",
      secondaryGenre: "street",
    };
  }

  if (focalLength >= 40 && focalLength <= 85) {
    return {
      confidence: 0.62,
      primaryGenre: "street",
      secondaryGenre: null,
    };
  }

  if (focalLength >= 150) {
    return {
      confidence: 0.58,
      primaryGenre: "wildlife",
      secondaryGenre: null,
    };
  }

  return {
    confidence: 0.45,
    primaryGenre: "other",
    secondaryGenre: null,
  };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
