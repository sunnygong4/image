import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  createPerson,
  getPersonBySource,
  listPeople,
  updatePerson,
  upsertAssetPerson,
  upsertPersonSource,
} from "@/lib/db";
import { getImmichAlbum, listImmichAlbums } from "@/lib/immich";
import { slugify } from "@/lib/slug";

interface LightroomFaceRow {
  capture_at?: string | null;
  face_height: number;
  face_left: number;
  face_top: number;
  face_width: number;
  filename: string;
  keyword_id: string;
  person_name: string;
  relative_catalog_path: string;
  source_confidence: number;
  source_face_key: string;
}

interface IndexedAsset {
  captureAt: string | null;
  id: string;
}

async function main() {
  const manifestPath = resolve(
    process.cwd(),
    process.argv[2] ?? "ops/catalog-ranking/lightroom-faces.json",
  );
  const unmatchedPath = resolve(
    process.cwd(),
    process.argv[3] ?? "ops/catalog-ranking/lightroom-faces-unmatched.csv",
  );
  const rows = JSON.parse(readFileSync(manifestPath, "utf8")) as LightroomFaceRow[];
  const peopleByName = new Map(
    listPeople()
      .map((person) => [normalizeName(person.displayName), person] as const)
      .filter(([key]) => key),
  );
  const index = await buildAssetIndex();
  const unmatched: LightroomFaceRow[] = [];
  let importedCount = 0;

  for (const row of rows) {
    const candidates = index.get(row.filename.toLowerCase()) ?? [];
    const match = pickBestMatch(row, candidates);

    if (!match) {
      unmatched.push(row);
      continue;
    }

    const bySource = getPersonBySource("lightroom", row.keyword_id);
    const byName = peopleByName.get(normalizeName(row.person_name)) ?? null;
    const person =
      bySource ??
      byName ??
      createPerson({
        confidenceScore: 1,
        displayName: row.person_name,
        slug: slugify(row.person_name),
        sourcePriority: 100,
        visibility: "public",
      });
    peopleByName.set(normalizeName(person.displayName), person);

    updatePerson(person.id, {
      confidenceScore: 1,
      sourcePriority: Math.max(person.sourcePriority, 100),
      visibility: person.visibility === "hidden" ? "hidden" : "public",
    });

    upsertPersonSource({
      confidenceScore: row.source_confidence,
      personId: person.id,
      rawPayload: JSON.stringify(row),
      sourceLabel: row.person_name,
      sourcePersonKey: row.keyword_id,
      sourceType: "lightroom",
    });
    upsertAssetPerson({
      confidenceScore: row.source_confidence,
      faceBox: {
        height: row.face_height,
        left: row.face_left,
        top: row.face_top,
        width: row.face_width,
      },
      immichAssetId: match.id,
      personId: person.id,
      reviewState: "approved",
      sourceFaceKey: row.source_face_key,
      sourceType: "lightroom",
    });
    importedCount += 1;
  }

  mkdirSync(dirname(unmatchedPath), { recursive: true });
  writeFileSync(unmatchedPath, toCsv(unmatched), "utf8");
  console.log(
    JSON.stringify({
      importedCount,
      manifestPath,
      unmatchedCount: unmatched.length,
      unmatchedPath,
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
      });
      index.set(key, current);
    }
  }

  return index;
}

function pickBestMatch(row: LightroomFaceRow, candidates: IndexedAsset[]) {
  if (!candidates.length) {
    return null;
  }

  if (candidates.length === 1 || !row.capture_at) {
    return candidates[0] ?? null;
  }

  const target = new Date(row.capture_at).getTime();
  if (Number.isNaN(target)) {
    return candidates[0] ?? null;
  }

  return [...candidates].sort((a, b) => {
    const aTime = a.captureAt ? new Date(a.captureAt).getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.captureAt ? new Date(b.captureAt).getTime() : Number.POSITIVE_INFINITY;
    return Math.abs(aTime - target) - Math.abs(bTime - target);
  })[0] ?? null;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function toCsv(rows: LightroomFaceRow[]) {
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
