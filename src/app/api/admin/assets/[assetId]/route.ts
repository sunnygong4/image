import { revalidatePath } from "next/cache";

import type { PortfolioAssetVisibility } from "@/lib/types";

import { getAlbumConfig } from "@/lib/db";
import { patchAssetConfig } from "@/lib/portfolio";
import { revalidatePortfolioPaths } from "@/lib/revalidate";
import type {
  PortfolioGenre,
  PortfolioRole,
  ReviewState,
} from "@/lib/types";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const albumId =
      typeof body.albumId === "string" && body.albumId.trim()
        ? body.albumId
        : null;

    if (!albumId) {
      throw new Error("albumId is required.");
    }

    const album = getAlbumConfig(albumId);
    if (!album) {
      return Response.json({ error: "Album not found." }, { status: 404 });
    }

    patchAssetConfig(assetId, albumId, {
      visibility: normalizeAssetVisibility(body.visibility),
      featured: normalizeBoolean(body.featured, false),
      allowDownload: normalizeBoolean(body.allowDownload, false),
      sortOrder: normalizeInteger(body.sortOrder, 0),
      titleOverride: normalizeNullableText(body.titleOverride),
      descriptionOverride: normalizeNullableText(body.descriptionOverride),
      primaryGenre: normalizeNullableGenre(body.primaryGenre),
      secondaryGenre: normalizeNullableGenre(body.secondaryGenre),
      portfolioRole: normalizePortfolioRole(body.portfolioRole),
      reviewState: normalizeReviewState(body.reviewState),
    });

    revalidatePortfolioPaths();
    revalidatePath(`/albums/${album.slug}`);
    revalidatePath(`/photos/${assetId}`);

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Asset update failed unexpectedly.",
      },
      { status: 400 },
    );
  }
}

function normalizeNullableGenre(value: unknown): PortfolioGenre | null {
  if (value === null || value === "") {
    return null;
  }

  if (
    value === "landscape" ||
    value === "street" ||
    value === "wildlife" ||
    value === "event" ||
    value === "product" ||
    value === "sports" ||
    value === "film" ||
    value === "other"
  ) {
    return value;
  }

  throw new Error("Genre must be a valid portfolio genre, including street, or empty.");
}

function normalizePortfolioRole(value: unknown): PortfolioRole {
  if (
    value === "signature" ||
    value === "specialty" ||
    value === "archive" ||
    value === "hidden"
  ) {
    return value;
  }

  throw new Error("Portfolio role must be signature, specialty, archive, or hidden.");
}

function normalizeReviewState(value: unknown): ReviewState {
  if (value === "suggested" || value === "approved" || value === "rejected") {
    return value;
  }

  throw new Error("Review state must be suggested, approved, or rejected.");
}

function normalizeAssetVisibility(value: unknown): PortfolioAssetVisibility {
  if (value === "inherit" || value === "private" || value === "public") {
    return value;
  }

  throw new Error("Asset visibility must be inherit, private, or public.");
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeInteger(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  return fallback;
}

function normalizeNullableText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
