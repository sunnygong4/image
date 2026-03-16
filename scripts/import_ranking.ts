import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { updateAssetAnnotation } from "@/lib/db";
import { getImmichAlbum, listImmichAlbums } from "@/lib/immich";
import { syncPortfolioFromImmich } from "@/lib/portfolio";
import type { PortfolioGenre, PortfolioRole } from "@/lib/types";

interface RankingRow {
  aesthetic_score?: number;
  ai_score?: number;
  ai_model?: string | null;
  ai_processed_at?: string | null;
  ai_provider?: string | null;
  ai_summary?: string | null;
  ai_tags?: string[] | null;
  capture_at?: string | null;
  duplicate_cluster_id?: string | null;
  export_candidate?: boolean | null;
  filename: string;
  genre_confidence?: number;
  portfolio_role_guess?: string | null;
  primary_genre_guess?: string | null;
  relative_path: string;
  semantic_score?: number | null;
  secondary_genre_guess?: string | null;
  technical_score?: number;
  uniqueness_score?: number;
}

interface IndexedAsset {
  captureAt: string | null;
  id: string;
  originalFileName: string;
}

async function main() {
  const manifestPath = resolve(
    process.cwd(),
    process.argv[2] ?? "ops/catalog-ranking/manifest.json",
  );
  const unmatchedPath = resolve(
    process.cwd(),
    process.argv[3] ?? "ops/catalog-ranking/unmatched-report.csv",
  );
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as RankingRow[];

  await syncPortfolioFromImmich();
  const index = await buildAssetIndex();
  const unmatched: RankingRow[] = [];
  let updatedCount = 0;

  for (const row of manifest) {
    const candidates = index.get(row.filename.toLowerCase()) ?? [];
    const match = pickBestMatch(row, candidates);

    if (!match) {
      unmatched.push(row);
      continue;
    }

    updateAssetAnnotation(match.id, {
      aiScore: numberOrNull(row.ai_score),
      aiModel: stringOrNull(row.ai_model),
      aiProcessedAt: stringOrNull(row.ai_processed_at),
      aiProvider: stringOrNull(row.ai_provider),
      aiSummary: stringOrNull(row.ai_summary),
      aiTags: stringArrayOrUndefined(row.ai_tags),
      aestheticScore: numberOrNull(row.aesthetic_score),
      duplicateClusterId: stringOrNull(row.duplicate_cluster_id),
      exportCandidate: booleanOrUndefined(row.export_candidate),
      genreConfidence: numberOrNull(row.genre_confidence),
      manifestPath: row.relative_path,
      portfolioRole: normalizeRole(row.portfolio_role_guess),
      primaryGenre: normalizeGenre(row.primary_genre_guess),
      reviewState: "suggested",
      semanticScore: numberOrNull(row.semantic_score),
      secondaryGenre: normalizeGenre(row.secondary_genre_guess),
      technicalScore: numberOrNull(row.technical_score),
      uniquenessScore: numberOrNull(row.uniqueness_score),
    });
    updatedCount += 1;
  }

  mkdirSync(dirname(unmatchedPath), { recursive: true });
  writeFileSync(unmatchedPath, toCsv(unmatched), "utf8");
  console.log(
    JSON.stringify({
      manifestPath,
      unmatchedPath,
      unmatchedCount: unmatched.length,
      updatedCount,
    }),
  );
}

async function buildAssetIndex() {
  const index = new Map<string, IndexedAsset[]>();

  for (const album of await listImmichAlbums()) {
    const detail = await getImmichAlbum(album.id);
    for (const asset of detail.assets ?? []) {
      if (asset.type === "VIDEO") {
        continue;
      }

      const key = asset.originalFileName.toLowerCase();
      const current = index.get(key) ?? [];
      current.push({
        captureAt:
          asset.exifInfo?.dateTimeOriginal ??
          asset.localDateTime ??
          asset.fileCreatedAt ??
          null,
        id: asset.id,
        originalFileName: asset.originalFileName,
      });
      index.set(key, current);
    }
  }

  return index;
}

function pickBestMatch(row: RankingRow, candidates: IndexedAsset[]) {
  if (!candidates.length) {
    return null;
  }

  if (candidates.length === 1 || !row.capture_at) {
    return candidates[0] ?? null;
  }

  const targetTime = new Date(row.capture_at).getTime();
  if (Number.isNaN(targetTime)) {
    return candidates[0] ?? null;
  }

  return [...candidates].sort((a, b) => {
    const aTime = a.captureAt ? new Date(a.captureAt).getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.captureAt ? new Date(b.captureAt).getTime() : Number.POSITIVE_INFINITY;
    return Math.abs(aTime - targetTime) - Math.abs(bTime - targetTime);
  })[0] ?? null;
}

function normalizeGenre(value: string | null | undefined): PortfolioGenre | null {
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

  return null;
}

function normalizeRole(value: string | null | undefined): PortfolioRole {
  if (
    value === "signature" ||
    value === "specialty" ||
    value === "archive" ||
    value === "hidden"
  ) {
    return value;
  }

  return "archive";
}

function stringOrNull(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberOrNull(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanOrUndefined(value: boolean | null | undefined) {
  return typeof value === "boolean" ? value : undefined;
}

function stringArrayOrUndefined(value: string[] | null | undefined) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function toCsv(rows: RankingRow[]) {
  if (!rows.length) {
    return "";
  }

  const headers = Object.keys(rows[0]!);
  const lines = [headers.join(",")];

  for (const row of rows) {
    lines.push(
      headers
        .map(
          (header) =>
            JSON.stringify(
              (row as unknown as Record<string, unknown>)[header] ?? "",
            ),
        )
        .join(","),
    );
  }

  return lines.join("\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
