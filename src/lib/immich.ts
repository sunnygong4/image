import { getPortfolioEnv } from "@/lib/env";
import type {
  FaceBox,
  ImmichAlbum,
  ImmichAsset,
  ImmichAssetFace,
  ImmichPerson,
  ImmichPersonAsset,
  PersonVisibility,
} from "@/lib/types";

type NextFetchOptions = RequestInit & {
  next?: {
    revalidate?: number;
  };
};

export interface SmartSearchHit {
  asset: ImmichAsset;
  score: number | null;
  matchedBy: string;
}

class ImmichRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
  }
}

function assertImmichConfig() {
  const env = getPortfolioEnv();

  if (!env.hasImmichConfig) {
    throw new Error(
      "IMMICH_URL and IMMICH_API_KEY must be set before the portfolio can read from Immich.",
    );
  }

  return env;
}

async function requestJson<T>(
  paths: string[],
  init: NextFetchOptions = {},
): Promise<T> {
  const response = await requestRaw(paths, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });

  return (await response.json()) as T;
}

async function requestRaw(paths: string[], init: NextFetchOptions = {}) {
  const env = assertImmichConfig();
  let lastError: Error | null = null;

  for (const path of paths) {
    const requestInit: NextFetchOptions = {
      ...init,
      headers: {
        "x-api-key": env.immichApiKey,
        ...(init.headers ?? {}),
      },
      next: init.next,
    };

    if (init.cache) {
      requestInit.cache = init.cache;
    } else if (init.next?.revalidate === undefined) {
      requestInit.cache = "no-store";
    }

    const response = await fetch(`${env.immichUrl}${path}`, requestInit);

    if (response.ok) {
      return response;
    }

    if (response.status === 404) {
      lastError = new ImmichRequestError(
        `Immich endpoint not found: ${path}`,
        response.status,
        path,
      );
      continue;
    }

    const body = await response.text();
    throw new ImmichRequestError(
      `Immich request failed for ${path}: ${response.status} ${body}`,
      response.status,
      path,
    );
  }

  throw (
    lastError ??
    new Error("No Immich endpoints were available for the requested operation.")
  );
}

export async function listImmichAlbums() {
  const payload = await requestJson<unknown[]>(["/api/albums", "/api/album"], {
    next: { revalidate: 300 },
  });

  return payload.map(normalizeAlbum);
}

export async function getImmichAlbum(albumId: string) {
  const payload = await requestJson<unknown>(
    [`/api/albums/${albumId}`, `/api/album/${albumId}`],
    {
      next: { revalidate: 300 },
    },
  );

  return normalizeAlbum(payload);
}

export async function getImmichAsset(assetId: string) {
  const payload = await requestJson<unknown>(
    [`/api/assets/${assetId}`, `/api/asset/${assetId}`],
    {
      next: { revalidate: 300 },
    },
  );

  return normalizeAsset(payload);
}

export async function searchImmichSmart(query: string) {
  const payload = await searchImmichAssets({
    query,
    size: 100,
  });

  return normalizeSmartSearch(payload);
}

export async function listImmichPeople() {
  const payload = await requestJson<unknown[]>(["/api/people", "/api/person"], {
    next: { revalidate: 300 },
  });

  return payload.map(normalizePerson);
}

export async function listImmichAssetsForPerson(personId: string) {
  const payload = await searchImmichAssets({
    personIds: [personId],
    size: 1000,
    withPeople: true,
  });

  const items = extractSearchItems(payload);
  if (!items) {
    return [] satisfies ImmichPersonAsset[];
  }

  return items
    .map((item) => {
      const asset = normalizeAsset(item);
      const face = (asset.people ?? []).find(
        (candidate) => candidate.personId === personId,
      );

      return {
        assetId: asset.id,
        confidenceScore: null,
        faceBox: face?.faceBox ?? null,
        sourceFaceKey: face?.faceAssetId ?? null,
      } satisfies ImmichPersonAsset;
    })
    .filter((item) => item.assetId);
}

export async function fetchImmichThumbnail(
  assetId: string,
  size: "thumbnail" | "preview" | "fullsize" = "preview",
) {
  return requestRaw(
    [
      `/api/assets/${assetId}/thumbnail?size=${size}`,
      `/api/asset/thumbnail/${assetId}?size=${size}`,
    ],
    {
      next: { revalidate: 300 },
    },
  );
}

export async function fetchImmichOriginal(assetId: string) {
  return requestRaw(
    [
      `/api/assets/${assetId}/original`,
      `/api/asset/download/${assetId}`,
      `/api/asset/file/${assetId}`,
      `/api/assets/${assetId}/thumbnail?size=fullsize`,
    ],
    {
      next: { revalidate: 300 },
    },
  );
}

export async function checkImmichConnection() {
  try {
    await listImmichAlbums();
    return {
      connected: true,
      message: "Immich is reachable and the API key is working.",
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Immich could not be reached from the portfolio app.";

    return {
      connected: false,
      message,
    };
  }
}

export async function searchImmichAssetsByLibrary(
  libraryId: string,
  page = 1,
  size = 1000,
) {
  const payload = await searchImmichAssets({
    libraryId,
    page,
    size,
    withExif: false,
  });

  const items = extractSearchItems(payload);
  if (!items) {
    return [] as ImmichAsset[];
  }

  return items.map(normalizeAsset);
}

export async function createImmichAlbum(
  albumName: string,
  description?: string,
  assetIds?: string[],
) {
  const body: Record<string, unknown> = { albumName };
  if (description) body.description = description;
  if (assetIds?.length) body.assetIds = assetIds;

  return requestJson<{ id: string; albumName: string }>(
    ["/api/albums", "/api/album"],
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );
}

export async function addAssetsToImmichAlbum(
  albumId: string,
  assetIds: string[],
) {
  return requestJson<unknown>(
    [`/api/albums/${albumId}/assets`, `/api/album/${albumId}/assets`],
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: assetIds }),
      cache: "no-store",
    },
  );
}

async function searchImmichAssets(body: Record<string, unknown>) {
  return requestJson<unknown>(
    ["/api/search/metadata", "/api/search/assets"],
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      next: { revalidate: 60 },
    },
  );
}

function normalizeAlbum(input: unknown): ImmichAlbum {
  const record = asRecord(input);
  const rawAssets = Array.isArray(record.assets) ? record.assets : [];

  return {
    id: String(record.id ?? ""),
    albumName: String(record.albumName ?? record.name ?? "Untitled Album"),
    description: nullableString(record.description),
    albumThumbnailAssetId: nullableString(
      record.albumThumbnailAssetId ?? record.albumThumbnailId,
    ),
    assetCount:
      typeof record.assetCount === "number"
        ? record.assetCount
        : rawAssets.length,
    createdAt: nullableString(record.createdAt),
    updatedAt: nullableString(record.updatedAt),
    startDate: nullableString(record.startDate),
    endDate: nullableString(record.endDate),
    assets: rawAssets.map(normalizeAsset),
  };
}

function normalizeAsset(input: unknown): ImmichAsset {
  const record = asRecord(input);
  const exifRecord = asNullableRecord(record.exifInfo);
  const originalFileName = String(
    record.originalFileName ?? record.fileName ?? record.id ?? "image.jpg",
  );

  return {
    id: String(record.id ?? ""),
    type: String(record.type ?? inferAssetType(originalFileName)),
    originalFileName,
    originalPath: nullableString(record.originalPath),
    originalMimeType: nullableString(
      record.originalMimeType ?? record.mimeType ?? null,
    ),
    fileCreatedAt: nullableString(record.fileCreatedAt),
    fileModifiedAt: nullableString(record.fileModifiedAt),
    localDateTime: nullableString(record.localDateTime),
    updatedAt: nullableString(record.updatedAt),
    thumbhash: nullableString(record.thumbhash),
    people: normalizeAssetPeople(record.people),
    exifInfo: exifRecord
      ? {
          description: nullableString(exifRecord.description),
          dateTimeOriginal: nullableString(exifRecord.dateTimeOriginal),
          fileSizeInByte:
            typeof exifRecord.fileSizeInByte === "number"
              ? exifRecord.fileSizeInByte
              : null,
          latitude:
            typeof exifRecord.latitude === "number" ? exifRecord.latitude : null,
          longitude:
            typeof exifRecord.longitude === "number"
              ? exifRecord.longitude
              : null,
          city: nullableString(exifRecord.city),
          state: nullableString(exifRecord.state),
          country: nullableString(exifRecord.country),
          make: nullableString(exifRecord.make),
          model: nullableString(exifRecord.model),
          lensModel: nullableString(exifRecord.lensModel),
          fNumber:
            typeof exifRecord.fNumber === "number" ? exifRecord.fNumber : null,
          focalLength:
            typeof exifRecord.focalLength === "number"
              ? exifRecord.focalLength
              : null,
          iso: typeof exifRecord.iso === "number" ? exifRecord.iso : null,
          exposureTime: nullableString(exifRecord.exposureTime),
          imageWidth:
            typeof exifRecord.imageWidth === "number"
              ? exifRecord.imageWidth
              : null,
          imageHeight:
            typeof exifRecord.imageHeight === "number"
              ? exifRecord.imageHeight
              : null,
        }
      : null,
  };
}

function normalizeSmartSearch(input: unknown): SmartSearchHit[] {
  const candidateItems = extractSearchItems(input);

  if (!candidateItems) {
    return [];
  }

  return candidateItems.map((item) => {
    const hitRecord = asRecord(item);
    const assetPayload = hitRecord.asset ?? hitRecord;

    return {
      asset: normalizeAsset(assetPayload),
      score:
        typeof hitRecord.score === "number"
          ? hitRecord.score
          : typeof hitRecord.distance === "number"
            ? 1 - hitRecord.distance
            : null,
      matchedBy: String(
        hitRecord.matchType ?? hitRecord.matchedBy ?? hitRecord.type ?? "smart",
      ),
    };
  });
}

function extractSearchItems(input: unknown) {
  const record = asRecord(input);
  const nestedAssets = asNullableRecord(record.assets);

  return [
    record.assets,
    nestedAssets?.items,
    record.results,
    record.items,
  ].find(Array.isArray) as unknown[] | undefined;
}

function normalizePerson(input: unknown): ImmichPerson {
  const record = asRecord(input);

  return {
    id: String(record.id ?? record.personId ?? ""),
    name: nullableString(record.name),
    isHidden: Boolean(record.isHidden ?? record.hidden),
    faceCount:
      typeof record.faceCount === "number"
        ? record.faceCount
        : typeof record.assetCount === "number"
          ? record.assetCount
          : null,
    thumbnailAssetId: nullableString(
      record.thumbnailAssetId ?? record.faceAssetId ?? record.assetId,
    ),
  };
}

function normalizeAssetPeople(input: unknown): ImmichAssetFace[] | undefined {
  if (!Array.isArray(input)) {
    return undefined;
  }

  const people = input
    .map((entry) => {
      const record = asRecord(entry);
      const face = asNullableRecord(record.face);

      return {
        faceAssetId: nullableString(
          record.faceAssetId ?? face?.id ?? face?.faceAssetId ?? null,
        ),
        faceBox: normalizeFaceBox(
          face?.boundingBox ??
            record.boundingBox ??
            record.faceBox ??
            record.facePosition ??
            null,
        ),
        personId: String(record.id ?? record.personId ?? record.person_id ?? ""),
        personName: nullableString(record.name ?? record.personName ?? null),
        visibility: normalizeVisibility(
          record.isHidden === true || record.hidden === true
            ? "hidden"
            : record.visibility,
        ),
      } satisfies ImmichAssetFace;
    })
    .filter((entry) => entry.personId);

  return people.length ? people : undefined;
}

function normalizeFaceBox(input: unknown): FaceBox | null {
  const record = asNullableRecord(input);
  if (!record) {
    return null;
  }

  const left = numericValue(record.left ?? record.minX ?? record.x1 ?? record.x);
  const top = numericValue(record.top ?? record.minY ?? record.y1 ?? record.y);
  const width = numericValue(
    record.width ??
      (numericValue(record.maxX ?? record.x2) !== null && left !== null
        ? numericValue(record.maxX ?? record.x2)! - left
        : null),
  );
  const height = numericValue(
    record.height ??
      (numericValue(record.maxY ?? record.y2) !== null && top !== null
        ? numericValue(record.maxY ?? record.y2)! - top
        : null),
  );

  if (left === null || top === null || width === null || height === null) {
    return null;
  }

  return { left, top, width, height };
}

function normalizeVisibility(value: unknown): PersonVisibility | null {
  if (value === "public" || value === "private" || value === "hidden") {
    return value;
  }

  return null;
}

function asRecord(input: unknown) {
  if (!input || typeof input !== "object") {
    return {} as Record<string, unknown>;
  }

  return input as Record<string, unknown>;
}

function asNullableRecord(input: unknown) {
  if (!input || typeof input !== "object") {
    return null;
  }

  return input as Record<string, unknown>;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function numericValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function inferAssetType(fileName: string) {
  return /\.(mov|mp4|avi|m4v|webm)$/i.test(fileName) ? "VIDEO" : "IMAGE";
}
