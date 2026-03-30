/**
 * Creates Immich albums based on folder structure in the external library.
 *
 * Folder patterns:
 *   /external-library/YYYY.MM/EventName/photo.jpg  -> album "Event Name"
 *   /external-library/YYYY.MM/photo.jpg             -> album "Month YYYY" (e.g. "June 2024")
 *   /external-library/Film.x/Film3/scan.jpg         -> album "Film Roll 3"
 *   /external-library/Polaroids/1.jpg               -> album "Polaroids"
 *   /external-library/Polaroid RAW/scan.tif          -> album "Polaroid RAW"
 */

import {
  addAssetsToImmichAlbum,
  createImmichAlbum,
  listImmichAlbums,
  searchImmichAssetsByLibrary,
} from "@/lib/immich";
import { loadLocalEnv } from "./load-local-env";

loadLocalEnv();

const LIBRARY_ID = process.env.IMMICH_LIBRARY_ID ?? "";
const EXTERNAL_PREFIX = "/external-library/";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function splitCamelCase(name: string): string {
  return name
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim();
}

function formatMonthFolder(folder: string): string {
  const match = folder.match(/^(\d{4})\.(\d{2})$/);
  if (!match) return folder;
  const year = match[1];
  const monthIndex = parseInt(match[2], 10) - 1;
  const monthName = MONTH_NAMES[monthIndex] ?? match[2];
  return `${monthName} ${year}`;
}

function parseFilmFolder(subfolder: string): string | null {
  const match = subfolder.match(/^Film(\d+)$/);
  if (match) return `Film Roll ${match[1]}`;
  if (subfolder === "Polaroids") return "Film Polaroids";
  return splitCamelCase(subfolder);
}

interface FolderGroup {
  albumName: string;
  assetIds: string[];
  genre: "event" | "film" | "other" | null;
}

function classifyAsset(originalPath: string): { key: string; albumName: string; genre: "event" | "film" | "other" | null } | null {
  if (!originalPath.startsWith(EXTERNAL_PREFIX)) return null;

  const relative = originalPath.slice(EXTERNAL_PREFIX.length);
  const parts = relative.split("/");
  if (parts.length < 2) return null;

  const topFolder = parts[0];

  // Film.x/Film3/scan.jpg
  if (topFolder === "Film.x" && parts.length >= 3) {
    const subfolder = parts[1];
    const albumName = parseFilmFolder(subfolder) ?? subfolder;
    return { key: `Film.x/${subfolder}`, albumName, genre: "film" };
  }

  // Polaroids/1.jpg or Polaroid RAW/scan.tif
  if (topFolder === "Polaroids" || topFolder === "Polaroid RAW") {
    return { key: topFolder, albumName: topFolder, genre: "film" };
  }

  // YYYY.MM pattern
  const isMonthFolder = /^\d{4}\.\d{2}$/.test(topFolder);
  if (isMonthFolder) {
    // YYYY.MM/EventName/photo.jpg -> event album
    if (parts.length >= 3) {
      const eventFolder = parts[1];
      const albumName = splitCamelCase(eventFolder);
      return { key: `${topFolder}/${eventFolder}`, albumName, genre: "event" };
    }
    // YYYY.MM/photo.jpg -> month album
    const albumName = formatMonthFolder(topFolder);
    return { key: topFolder, albumName, genre: "other" };
  }

  // Fallback: top-level folder
  return { key: topFolder, albumName: splitCamelCase(topFolder), genre: "other" };
}

async function fetchAllLibraryAssets() {
  const allAssets: { id: string; originalPath: string }[] = [];
  let page = 1;

  while (true) {
    console.log(`  Fetching page ${page}...`);
    const batch = await searchImmichAssetsByLibrary(LIBRARY_ID, page, 1000);
    if (batch.length === 0) break;

    for (const asset of batch) {
      if (asset.originalPath) {
        allAssets.push({ id: asset.id, originalPath: asset.originalPath });
      }
    }

    if (batch.length < 1000) break;
    page++;
  }

  return allAssets;
}

async function main() {
  if (!LIBRARY_ID) {
    console.error("IMMICH_LIBRARY_ID is not set. Create an external library in Immich first.");
    process.exitCode = 1;
    return;
  }

  console.log("Fetching assets from Immich library...");
  const assets = await fetchAllLibraryAssets();
  console.log(`Found ${assets.length} assets with paths.`);

  // Group assets by folder
  const groups = new Map<string, FolderGroup>();
  let unclassified = 0;

  for (const asset of assets) {
    const result = classifyAsset(asset.originalPath);
    if (!result) {
      unclassified++;
      continue;
    }

    let group = groups.get(result.key);
    if (!group) {
      group = { albumName: result.albumName, assetIds: [], genre: result.genre };
      groups.set(result.key, group);
    }
    group.assetIds.push(asset.id);
  }

  console.log(`\nClassified into ${groups.size} albums (${unclassified} unclassified).`);
  console.log();

  // Fetch existing albums to avoid duplicates
  const existingAlbums = await listImmichAlbums();
  const existingByName = new Map(existingAlbums.map((a) => [a.albumName, a.id]));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const [key, group] of groups) {
    const existing = existingByName.get(group.albumName);

    if (existing) {
      // Add any new assets to existing album
      console.log(`  [exists] "${group.albumName}" (${group.assetIds.length} assets) -> adding to ${existing}`);
      await addAssetsToImmichAlbum(existing, group.assetIds);
      updated++;
    } else {
      // Create new album in batches (Immich may limit per-request)
      const firstBatch = group.assetIds.slice(0, 500);
      const rest = group.assetIds.slice(500);

      console.log(`  [create] "${group.albumName}" (${group.assetIds.length} assets) [${key}]`);
      const album = await createImmichAlbum(group.albumName, undefined, firstBatch);
      existingByName.set(group.albumName, album.id);

      if (rest.length > 0) {
        await addAssetsToImmichAlbum(album.id, rest);
      }
      created++;
    }
  }

  console.log(`\nDone! Created ${created}, updated ${updated}, skipped ${skipped} albums.`);

  // Print genre summary
  const genreCounts = { event: 0, film: 0, other: 0 };
  for (const group of groups.values()) {
    if (group.genre) genreCounts[group.genre]++;
  }
  console.log(`Genre breakdown: ${genreCounts.event} event, ${genreCounts.film} film, ${genreCounts.other} other/monthly`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
