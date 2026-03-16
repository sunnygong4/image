import { revalidatePath } from "next/cache";

import type { PortfolioVisibility } from "@/lib/types";

import { getAlbumConfig } from "@/lib/db";
import { patchAlbumConfig } from "@/lib/portfolio";
import { revalidatePortfolioPaths } from "@/lib/revalidate";
import { slugify } from "@/lib/slug";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  const { albumId } = await params;
  const existing = getAlbumConfig(albumId);

  if (!existing) {
    return Response.json({ error: "Album config not found." }, { status: 404 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const patch = {
      slug:
        typeof body.slug === "string" && body.slug.trim()
          ? slugify(body.slug)
          : existing.slug,
      visibility: normalizeAlbumVisibility(body.visibility),
      featured: normalizeBoolean(body.featured, existing.featured),
      sortOrder: normalizeInteger(body.sortOrder, existing.sortOrder),
      coverAssetId: normalizeNullableText(body.coverAssetId),
      titleOverride: normalizeNullableText(body.titleOverride),
      descriptionOverride: normalizeNullableText(body.descriptionOverride),
      shareUrl: normalizeNullableText(body.shareUrl),
    };

    const updated = patchAlbumConfig(albumId, patch);

    revalidatePortfolioPaths();
    revalidatePath(`/albums/${existing.slug}`);
    revalidatePath(`/albums/${patch.slug}`);

    return Response.json({ ok: true, album: updated });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Album update failed unexpectedly.",
      },
      { status: 400 },
    );
  }
}

function normalizeAlbumVisibility(value: unknown): PortfolioVisibility {
  if (value === "public" || value === "private") {
    return value;
  }

  throw new Error("Visibility must be 'public' or 'private'.");
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
