import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { getPortfolioEnv } from "@/lib/env";
import { slugify, uniqueSlug } from "@/lib/slug";
import type {
  AdminAssetPerson,
  AssetAnnotation,
  AssetPerson,
  Person,
  PersonSource,
  PersonSourceType,
  PersonVisibility,
  PortfolioAlbumConfig,
  PortfolioAssetConfig,
  PortfolioAssetVisibility,
  PortfolioGenre,
  PortfolioRole,
  PortfolioVisibility,
  ReviewState,
} from "@/lib/types";
import type { AssetAssociation } from "@/lib/visibility";

declare global {
  var __portfolioDb: DatabaseSync | undefined;
}

interface AlbumConfigInput {
  immichAlbumId: string;
  slug: string;
  coverAssetId?: string | null;
  immichTitle?: string | null;
  immichDescription?: string | null;
  immichThumbnailAssetId?: string | null;
  immichStartDate?: string | null;
  category?: PortfolioAlbumConfig['category'];
}

interface AlbumConfigPatch {
  slug?: string;
  visibility?: PortfolioVisibility;
  featured?: boolean;
  sortOrder?: number;
  coverAssetId?: string | null;
  titleOverride?: string | null;
  descriptionOverride?: string | null;
  shareUrl?: string | null;
  category?: PortfolioAlbumConfig['category'];
}

interface AssetConfigPatch {
  visibility?: PortfolioAssetVisibility;
  featured?: boolean;
  sortOrder?: number;
  allowDownload?: boolean;
  titleOverride?: string | null;
  descriptionOverride?: string | null;
}

interface AssetAnnotationPatch {
  aiScore?: number | null;
  aiModel?: string | null;
  aiProcessedAt?: string | null;
  aiProvider?: string | null;
  aiSummary?: string | null;
  aiTags?: string[];
  aestheticScore?: number | null;
  duplicateClusterId?: string | null;
  exportCandidate?: boolean;
  genreConfidence?: number | null;
  manifestPath?: string | null;
  portfolioRole?: PortfolioRole;
  primaryGenre?: PortfolioGenre | null;
  reviewState?: ReviewState;
  semanticScore?: number | null;
  secondaryGenre?: PortfolioGenre | null;
  technicalScore?: number | null;
  uniquenessScore?: number | null;
}

interface CreatePersonInput {
  confidenceScore?: number | null;
  displayName: string;
  id?: string;
  slug?: string;
  sourcePriority?: number;
  visibility?: PersonVisibility;
}

interface PersonPatch {
  confidenceScore?: number | null;
  displayName?: string;
  slug?: string;
  sourcePriority?: number;
  visibility?: PersonVisibility;
}

interface PersonSourceInput {
  confidenceScore?: number | null;
  personId: string;
  rawPayload?: string | null;
  sourceLabel?: string | null;
  sourcePersonKey: string;
  sourceType: PersonSourceType;
}

interface AssetPersonInput {
  confidenceScore?: number | null;
  faceBox?: {
    height: number;
    left: number;
    top: number;
    width: number;
  } | null;
  immichAssetId: string;
  personId: string;
  reviewState?: ReviewState;
  sourceFaceKey?: string | null;
  sourceType: PersonSourceType;
}

const GENRE_SQL =
  "'landscape', 'street', 'wildlife', 'event', 'product', 'sports', 'film', 'other'";
const ROLE_SQL = "'signature', 'specialty', 'archive', 'hidden'";
const REVIEW_SQL = "'suggested', 'approved', 'rejected'";
const PERSON_VISIBILITY_SQL = "'public', 'private', 'hidden'";
const PERSON_SOURCE_SQL = "'lightroom', 'immich', 'manual'";

export function getDatabase() {
  if (!globalThis.__portfolioDb) {
    const dbPath = getPortfolioEnv().portfolioDbPath;
    mkdirSync(dirname(dbPath), { recursive: true });

    const db = new DatabaseSync(dbPath);
    db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS album_configs (
        immich_album_id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
        featured INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        cover_asset_id TEXT,
        title_override TEXT,
        description_override TEXT,
        share_url TEXT,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE TABLE IF NOT EXISTS asset_configs (
        immich_asset_id TEXT NOT NULL,
        album_id TEXT NOT NULL,
        visibility TEXT NOT NULL DEFAULT 'inherit' CHECK (visibility IN ('inherit', 'private', 'public')),
        featured INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        allow_download INTEGER NOT NULL DEFAULT 0,
        title_override TEXT,
        description_override TEXT,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        PRIMARY KEY (immich_asset_id, album_id),
        FOREIGN KEY (album_id) REFERENCES album_configs(immich_album_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS asset_annotations (
        immich_asset_id TEXT PRIMARY KEY,
        primary_genre TEXT CHECK (primary_genre IS NULL OR primary_genre IN (${GENRE_SQL})),
        secondary_genre TEXT CHECK (secondary_genre IS NULL OR secondary_genre IN (${GENRE_SQL})),
        portfolio_role TEXT NOT NULL DEFAULT 'archive' CHECK (portfolio_role IN (${ROLE_SQL})),
        ai_score REAL,
        semantic_score REAL,
        aesthetic_score REAL,
        technical_score REAL,
        uniqueness_score REAL,
        genre_confidence REAL,
        duplicate_cluster_id TEXT,
        ai_summary TEXT,
        ai_tags_json TEXT,
        ai_provider TEXT,
        ai_model TEXT,
        ai_processed_at TEXT,
        export_candidate INTEGER NOT NULL DEFAULT 0,
        review_state TEXT NOT NULL DEFAULT 'suggested' CHECK (review_state IN (${REVIEW_SQL})),
        manifest_path TEXT,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE TABLE IF NOT EXISTS people (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN (${PERSON_VISIBILITY_SQL})),
        source_priority INTEGER NOT NULL DEFAULT 0,
        confidence_score REAL,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE TABLE IF NOT EXISTS person_sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id TEXT NOT NULL,
        source_type TEXT NOT NULL CHECK (source_type IN (${PERSON_SOURCE_SQL})),
        source_person_key TEXT NOT NULL,
        source_label TEXT,
        confidence_score REAL,
        raw_payload TEXT,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE (source_type, source_person_key),
        FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS asset_people (
        person_id TEXT NOT NULL,
        immich_asset_id TEXT NOT NULL,
        source_type TEXT NOT NULL CHECK (source_type IN (${PERSON_SOURCE_SQL})),
        source_face_key TEXT NOT NULL DEFAULT '',
        confidence_score REAL,
        review_state TEXT NOT NULL DEFAULT 'approved' CHECK (review_state IN (${REVIEW_SQL})),
        face_left REAL,
        face_top REAL,
        face_width REAL,
        face_height REAL,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        PRIMARY KEY (person_id, immich_asset_id, source_type, source_face_key),
        FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_asset_album_id ON asset_configs(album_id);
      CREATE INDEX IF NOT EXISTS idx_asset_immich_id ON asset_configs(immich_asset_id);
      CREATE INDEX IF NOT EXISTS idx_annotation_role ON asset_annotations(portfolio_role, review_state, primary_genre);
      CREATE INDEX IF NOT EXISTS idx_people_slug ON people(slug);
      CREATE INDEX IF NOT EXISTS idx_asset_people_asset ON asset_people(immich_asset_id);
      CREATE INDEX IF NOT EXISTS idx_asset_people_person ON asset_people(person_id);
      CREATE INDEX IF NOT EXISTS idx_person_sources_person ON person_sources(person_id);
    `);

    ensureAssetAnnotationGenreSchema(db);
    ensureAssetAnnotationAiColumns(db);
    ensureAlbumCachedColumns(db);
    ensureAlbumCategoryColumn(db);

    globalThis.__portfolioDb = db;
  }

  return globalThis.__portfolioDb;
}

function ensureAssetAnnotationGenreSchema(db: DatabaseSync) {
  const row = db
    .prepare(
      `
        SELECT sql
        FROM sqlite_master
        WHERE type = 'table' AND name = 'asset_annotations'
      `,
    )
    .get() as { sql?: string } | undefined;

  if (!row?.sql || row.sql.includes("'street'")) {
    return;
  }

  db.exec(`
    BEGIN;

    CREATE TABLE asset_annotations_next (
      immich_asset_id TEXT PRIMARY KEY,
      primary_genre TEXT CHECK (primary_genre IS NULL OR primary_genre IN (${GENRE_SQL})),
      secondary_genre TEXT CHECK (secondary_genre IS NULL OR secondary_genre IN (${GENRE_SQL})),
      portfolio_role TEXT NOT NULL DEFAULT 'archive' CHECK (portfolio_role IN (${ROLE_SQL})),
      ai_score REAL,
      aesthetic_score REAL,
      technical_score REAL,
      uniqueness_score REAL,
      genre_confidence REAL,
      duplicate_cluster_id TEXT,
      review_state TEXT NOT NULL DEFAULT 'suggested' CHECK (review_state IN (${REVIEW_SQL})),
      manifest_path TEXT,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    INSERT INTO asset_annotations_next (
      immich_asset_id,
      primary_genre,
      secondary_genre,
      portfolio_role,
      ai_score,
      aesthetic_score,
      technical_score,
      uniqueness_score,
      genre_confidence,
      duplicate_cluster_id,
      review_state,
      manifest_path,
      updated_at
    )
    SELECT
      immich_asset_id,
      primary_genre,
      secondary_genre,
      portfolio_role,
      ai_score,
      aesthetic_score,
      technical_score,
      uniqueness_score,
      genre_confidence,
      duplicate_cluster_id,
      review_state,
      manifest_path,
      updated_at
    FROM asset_annotations;

    DROP TABLE asset_annotations;
    ALTER TABLE asset_annotations_next RENAME TO asset_annotations;
    CREATE INDEX IF NOT EXISTS idx_annotation_role ON asset_annotations(portfolio_role, review_state, primary_genre);

    COMMIT;
  `);
}

function ensureAssetAnnotationAiColumns(db: DatabaseSync) {
  const columns = new Set(
    (
      db
        .prepare(`PRAGMA table_info(asset_annotations)`)
        .all() as Array<{ name?: string }>
    ).map((column) => column.name ?? ""),
  );

  const additions = [
    ["semantic_score", "ALTER TABLE asset_annotations ADD COLUMN semantic_score REAL"],
    ["ai_summary", "ALTER TABLE asset_annotations ADD COLUMN ai_summary TEXT"],
    ["ai_tags_json", "ALTER TABLE asset_annotations ADD COLUMN ai_tags_json TEXT"],
    ["ai_provider", "ALTER TABLE asset_annotations ADD COLUMN ai_provider TEXT"],
    ["ai_model", "ALTER TABLE asset_annotations ADD COLUMN ai_model TEXT"],
    ["ai_processed_at", "ALTER TABLE asset_annotations ADD COLUMN ai_processed_at TEXT"],
    [
      "export_candidate",
      "ALTER TABLE asset_annotations ADD COLUMN export_candidate INTEGER NOT NULL DEFAULT 0",
    ],
  ] as const;

  for (const [column, statement] of additions) {
    if (!columns.has(column)) {
      db.exec(statement);
    }
  }
}

function ensureAlbumCachedColumns(db: DatabaseSync) {
  const columns = new Set(
    (
      db
        .prepare(`PRAGMA table_info(album_configs)`)
        .all() as Array<{ name?: string }>
    ).map((column) => column.name ?? ""),
  );

  const additions = [
    ["immich_title", "ALTER TABLE album_configs ADD COLUMN immich_title TEXT"],
    ["immich_description", "ALTER TABLE album_configs ADD COLUMN immich_description TEXT"],
    ["immich_thumbnail_asset_id", "ALTER TABLE album_configs ADD COLUMN immich_thumbnail_asset_id TEXT"],
    ["immich_start_date", "ALTER TABLE album_configs ADD COLUMN immich_start_date TEXT"],
  ] as const;

  for (const [column, statement] of additions) {
    if (!columns.has(column)) {
      db.exec(statement);
    }
  }
}

function ensureAlbumCategoryColumn(db: DatabaseSync) {
  const columns = new Set(
    (db.prepare(`PRAGMA table_info(album_configs)`).all() as Array<{ name?: string }>)
      .map((c) => c.name ?? ""),
  );
  if (!columns.has("category")) {
    db.exec(
      `ALTER TABLE album_configs ADD COLUMN category TEXT CHECK (category IS NULL OR category IN ('event', 'month', 'film-roll', 'hidden'))`,
    );
  }
}

export function listAlbumConfigs() {
  const rows = getDatabase()
    .prepare(
      `
        SELECT
          immich_album_id,
          slug,
          visibility,
          featured,
          sort_order,
          cover_asset_id,
          title_override,
          description_override,
          share_url,
          updated_at,
          immich_title,
          immich_description,
          immich_thumbnail_asset_id,
          immich_start_date,
          category
        FROM album_configs
        ORDER BY featured DESC, sort_order ASC, slug ASC
      `,
    )
    .all();

  return rows.map(mapAlbumConfig);
}

export function getAlbumConfigBySlug(slug: string) {
  const row = getDatabase()
    .prepare(
      `
        SELECT
          immich_album_id,
          slug,
          visibility,
          featured,
          sort_order,
          cover_asset_id,
          title_override,
          description_override,
          share_url,
          updated_at,
          immich_title,
          immich_description,
          immich_thumbnail_asset_id,
          immich_start_date,
          category
        FROM album_configs
        WHERE slug = ?
      `,
    )
    .get(slug);

  return row ? mapAlbumConfig(row) : null;
}

export function getAlbumConfig(immichAlbumId: string) {
  const row = getDatabase()
    .prepare(
      `
        SELECT
          immich_album_id,
          slug,
          visibility,
          featured,
          sort_order,
          cover_asset_id,
          title_override,
          description_override,
          share_url,
          updated_at,
          immich_title,
          immich_description,
          immich_thumbnail_asset_id,
          immich_start_date,
          category
        FROM album_configs
        WHERE immich_album_id = ?
      `,
    )
    .get(immichAlbumId);

  return row ? mapAlbumConfig(row) : null;
}

export function upsertAlbumDefaults(input: AlbumConfigInput) {
  getDatabase()
    .prepare(
      `
        INSERT INTO album_configs (
          immich_album_id,
          slug,
          cover_asset_id,
          visibility,
          immich_title,
          immich_description,
          immich_thumbnail_asset_id,
          immich_start_date
        )
        VALUES (?, ?, ?, 'public', ?, ?, ?, ?)
        ON CONFLICT(immich_album_id) DO UPDATE SET
          cover_asset_id = COALESCE(album_configs.cover_asset_id, excluded.cover_asset_id),
          immich_title = excluded.immich_title,
          immich_description = excluded.immich_description,
          immich_thumbnail_asset_id = excluded.immich_thumbnail_asset_id,
          immich_start_date = excluded.immich_start_date
      `,
    )
    .run(
      input.immichAlbumId,
      input.slug,
      input.coverAssetId ?? null,
      input.immichTitle ?? null,
      input.immichDescription ?? null,
      input.immichThumbnailAssetId ?? null,
      input.immichStartDate ?? null,
    );
  // category is set separately so syncs never overwrite a manually-assigned category
  if (input.category !== undefined) {
    getDatabase()
      .prepare(`UPDATE album_configs SET category = ? WHERE immich_album_id = ?`)
      .run(input.category ?? null, input.immichAlbumId);
  }
}

export function updateAlbumConfig(
  immichAlbumId: string,
  patch: AlbumConfigPatch,
) {
  const assignments: string[] = [];
  const values: Array<number | string | null> = [];

  if (patch.slug !== undefined) {
    assignments.push("slug = ?");
    values.push(patch.slug);
  }

  if (patch.visibility !== undefined) {
    assignments.push("visibility = ?");
    values.push(patch.visibility);
  }

  if (patch.featured !== undefined) {
    assignments.push("featured = ?");
    values.push(Number(patch.featured));
  }

  if (patch.sortOrder !== undefined) {
    assignments.push("sort_order = ?");
    values.push(patch.sortOrder);
  }

  if (patch.coverAssetId !== undefined) {
    assignments.push("cover_asset_id = ?");
    values.push(patch.coverAssetId);
  }

  if (patch.titleOverride !== undefined) {
    assignments.push("title_override = ?");
    values.push(patch.titleOverride);
  }

  if (patch.descriptionOverride !== undefined) {
    assignments.push("description_override = ?");
    values.push(patch.descriptionOverride);
  }

  if (patch.shareUrl !== undefined) {
    assignments.push("share_url = ?");
    values.push(patch.shareUrl);
  }

  if (patch.category !== undefined) {
    assignments.push("category = ?");
    values.push(patch.category ?? null);
  }

  if (!assignments.length) {
    return getAlbumConfig(immichAlbumId);
  }

  assignments.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");
  values.push(immichAlbumId);

  getDatabase()
    .prepare(
      `
        UPDATE album_configs
        SET ${assignments.join(", ")}
        WHERE immich_album_id = ?
      `,
    )
    .run(...values);

  return getAlbumConfig(immichAlbumId);
}

export function listAssetConfigsForAlbum(albumId: string) {
  const rows = getDatabase()
    .prepare(
      `
        SELECT
          immich_asset_id,
          album_id,
          visibility,
          featured,
          sort_order,
          allow_download,
          title_override,
          description_override,
          updated_at
        FROM asset_configs
        WHERE album_id = ?
        ORDER BY featured DESC, sort_order ASC, immich_asset_id ASC
      `,
    )
    .all(albumId);

  return rows.map(mapAssetConfig);
}

export function listAssetAssociations() {
  const rows = getDatabase()
    .prepare(
      `
        SELECT
          ac.immich_asset_id,
          ac.album_id,
          a.slug AS album_slug,
          a.visibility AS album_visibility,
          ac.visibility AS asset_visibility,
          ac.allow_download,
          ac.featured,
          ac.sort_order,
          ac.title_override,
          ac.description_override,
          a.share_url
        FROM asset_configs ac
        INNER JOIN album_configs a
          ON a.immich_album_id = ac.album_id
      `,
    )
    .all();

  return rows.map(mapAssetAssociation);
}

export function listAssetAssociationsForAlbum(albumId: string) {
  const rows = getDatabase()
    .prepare(
      `
        SELECT
          ac.immich_asset_id,
          ac.album_id,
          a.slug AS album_slug,
          a.visibility AS album_visibility,
          ac.visibility AS asset_visibility,
          ac.allow_download,
          ac.featured,
          ac.sort_order,
          ac.title_override,
          ac.description_override,
          a.share_url
        FROM asset_configs ac
        INNER JOIN album_configs a
          ON a.immich_album_id = ac.album_id
        WHERE ac.album_id = ?
      `,
    )
    .all(albumId);

  return rows.map(mapAssetAssociation);
}

export function listAssetAssociationsForAsset(assetId: string) {
  const rows = getDatabase()
    .prepare(
      `
        SELECT
          ac.immich_asset_id,
          ac.album_id,
          a.slug AS album_slug,
          a.visibility AS album_visibility,
          ac.visibility AS asset_visibility,
          ac.allow_download,
          ac.featured,
          ac.sort_order,
          ac.title_override,
          ac.description_override,
          a.share_url
        FROM asset_configs ac
        INNER JOIN album_configs a
          ON a.immich_album_id = ac.album_id
        WHERE ac.immich_asset_id = ?
      `,
    )
    .all(assetId);

  return rows.map(mapAssetAssociation);
}

export function listAssetAssociationsForAssetIds(assetIds: string[]) {
  if (!assetIds.length) {
    return [];
  }

  const placeholders = assetIds.map(() => "?").join(", ");
  const rows = getDatabase()
    .prepare(
      `
        SELECT
          ac.immich_asset_id,
          ac.album_id,
          a.slug AS album_slug,
          a.visibility AS album_visibility,
          ac.visibility AS asset_visibility,
          ac.allow_download,
          ac.featured,
          ac.sort_order,
          ac.title_override,
          ac.description_override,
          a.share_url
        FROM asset_configs ac
        INNER JOIN album_configs a
          ON a.immich_album_id = ac.album_id
        WHERE ac.immich_asset_id IN (${placeholders})
      `,
    )
    .all(...assetIds);

  return rows.map(mapAssetAssociation);
}

export function updateAssetConfig(
  assetId: string,
  albumId: string,
  patch: AssetConfigPatch,
) {
  const assignments: string[] = [];
  const values: Array<number | string | null> = [];

  if (patch.visibility !== undefined) {
    assignments.push("visibility = ?");
    values.push(patch.visibility);
  }

  if (patch.featured !== undefined) {
    assignments.push("featured = ?");
    values.push(Number(patch.featured));
  }

  if (patch.sortOrder !== undefined) {
    assignments.push("sort_order = ?");
    values.push(patch.sortOrder);
  }

  if (patch.allowDownload !== undefined) {
    assignments.push("allow_download = ?");
    values.push(Number(patch.allowDownload));
  }

  if (patch.titleOverride !== undefined) {
    assignments.push("title_override = ?");
    values.push(patch.titleOverride);
  }

  if (patch.descriptionOverride !== undefined) {
    assignments.push("description_override = ?");
    values.push(patch.descriptionOverride);
  }

  if (!assignments.length) {
    return;
  }

  assignments.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");
  values.push(assetId, albumId);

  getDatabase()
    .prepare(
      `
        UPDATE asset_configs
        SET ${assignments.join(", ")}
        WHERE immich_asset_id = ? AND album_id = ?
      `,
    )
    .run(...values);
}

export function syncAssetMembership(albumId: string, assetIds: string[]) {
  withTransaction(() => {
    const db = getDatabase();
    const insertStatement = db.prepare(
      `
        INSERT INTO asset_configs (immich_asset_id, album_id)
        VALUES (?, ?)
        ON CONFLICT(immich_asset_id, album_id) DO NOTHING
      `,
    );

    for (const assetId of assetIds) {
      insertStatement.run(assetId, albumId);
    }

    if (!assetIds.length) {
      db.prepare("DELETE FROM asset_configs WHERE album_id = ?").run(albumId);
      return;
    }

    const placeholders = assetIds.map(() => "?").join(", ");
    db.prepare(
      `
        DELETE FROM asset_configs
        WHERE album_id = ?
          AND immich_asset_id NOT IN (${placeholders})
      `,
    ).run(albumId, ...assetIds);
  });
}

export function ensureAssetAnnotations(assetIds: string[]) {
  if (!assetIds.length) {
    return;
  }

  withTransaction(() => {
    const statement = getDatabase().prepare(
      `
        INSERT INTO asset_annotations (immich_asset_id)
        VALUES (?)
        ON CONFLICT(immich_asset_id) DO NOTHING
      `,
    );

    for (const assetId of assetIds) {
      statement.run(assetId);
    }
  });
}

export function getAssetAnnotation(assetId: string) {
  const row = getDatabase()
    .prepare(
      `
        SELECT
          immich_asset_id,
          primary_genre,
          secondary_genre,
          portfolio_role,
          ai_score,
          semantic_score,
          aesthetic_score,
          technical_score,
          uniqueness_score,
          genre_confidence,
          duplicate_cluster_id,
          ai_summary,
          ai_tags_json,
          ai_provider,
          ai_model,
          ai_processed_at,
          export_candidate,
          review_state,
          manifest_path,
          updated_at
        FROM asset_annotations
        WHERE immich_asset_id = ?
      `,
    )
    .get(assetId);

  return row ? mapAssetAnnotation(row) : null;
}

export function listAssetAnnotations() {
  const rows = getDatabase()
    .prepare(
      `
        SELECT
          immich_asset_id,
          primary_genre,
          secondary_genre,
          portfolio_role,
          ai_score,
          semantic_score,
          aesthetic_score,
          technical_score,
          uniqueness_score,
          genre_confidence,
          duplicate_cluster_id,
          ai_summary,
          ai_tags_json,
          ai_provider,
          ai_model,
          ai_processed_at,
          export_candidate,
          review_state,
          manifest_path,
          updated_at
        FROM asset_annotations
      `,
    )
    .all();

  return rows.map(mapAssetAnnotation);
}

export function listAssetAnnotationsForAssetIds(assetIds: string[]) {
  if (!assetIds.length) {
    return [];
  }

  ensureAssetAnnotations(assetIds);
  const placeholders = assetIds.map(() => "?").join(", ");
  const rows = getDatabase()
    .prepare(
      `
        SELECT
          immich_asset_id,
          primary_genre,
          secondary_genre,
          portfolio_role,
          ai_score,
          semantic_score,
          aesthetic_score,
          technical_score,
          uniqueness_score,
          genre_confidence,
          duplicate_cluster_id,
          ai_summary,
          ai_tags_json,
          ai_provider,
          ai_model,
          ai_processed_at,
          export_candidate,
          review_state,
          manifest_path,
          updated_at
        FROM asset_annotations
        WHERE immich_asset_id IN (${placeholders})
      `,
    )
    .all(...assetIds);

  return rows.map(mapAssetAnnotation);
}

export function updateAssetAnnotation(
  assetId: string,
  patch: AssetAnnotationPatch,
) {
  ensureAssetAnnotations([assetId]);

  const assignments: string[] = [];
  const values: Array<number | string | null> = [];

  if (patch.primaryGenre !== undefined) {
    assignments.push("primary_genre = ?");
    values.push(patch.primaryGenre);
  }

  if (patch.secondaryGenre !== undefined) {
    assignments.push("secondary_genre = ?");
    values.push(patch.secondaryGenre);
  }

  if (patch.portfolioRole !== undefined) {
    assignments.push("portfolio_role = ?");
    values.push(patch.portfolioRole);
  }

  if (patch.aiScore !== undefined) {
    assignments.push("ai_score = ?");
    values.push(patch.aiScore);
  }

  if (patch.semanticScore !== undefined) {
    assignments.push("semantic_score = ?");
    values.push(patch.semanticScore);
  }

  if (patch.aestheticScore !== undefined) {
    assignments.push("aesthetic_score = ?");
    values.push(patch.aestheticScore);
  }

  if (patch.technicalScore !== undefined) {
    assignments.push("technical_score = ?");
    values.push(patch.technicalScore);
  }

  if (patch.uniquenessScore !== undefined) {
    assignments.push("uniqueness_score = ?");
    values.push(patch.uniquenessScore);
  }

  if (patch.genreConfidence !== undefined) {
    assignments.push("genre_confidence = ?");
    values.push(patch.genreConfidence);
  }

  if (patch.duplicateClusterId !== undefined) {
    assignments.push("duplicate_cluster_id = ?");
    values.push(patch.duplicateClusterId);
  }

  if (patch.aiSummary !== undefined) {
    assignments.push("ai_summary = ?");
    values.push(patch.aiSummary);
  }

  if (patch.aiTags !== undefined) {
    assignments.push("ai_tags_json = ?");
    values.push(JSON.stringify(patch.aiTags));
  }

  if (patch.aiProvider !== undefined) {
    assignments.push("ai_provider = ?");
    values.push(patch.aiProvider);
  }

  if (patch.aiModel !== undefined) {
    assignments.push("ai_model = ?");
    values.push(patch.aiModel);
  }

  if (patch.aiProcessedAt !== undefined) {
    assignments.push("ai_processed_at = ?");
    values.push(patch.aiProcessedAt);
  }

  if (patch.exportCandidate !== undefined) {
    assignments.push("export_candidate = ?");
    values.push(Number(patch.exportCandidate));
  }

  if (patch.reviewState !== undefined) {
    assignments.push("review_state = ?");
    values.push(patch.reviewState);
  }

  if (patch.manifestPath !== undefined) {
    assignments.push("manifest_path = ?");
    values.push(patch.manifestPath);
  }

  if (!assignments.length) {
    return getAssetAnnotation(assetId);
  }

  assignments.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");
  values.push(assetId);

  getDatabase()
    .prepare(
      `
        UPDATE asset_annotations
        SET ${assignments.join(", ")}
        WHERE immich_asset_id = ?
      `,
    )
    .run(...values);

  return getAssetAnnotation(assetId);
}

export function listPeople() {
  const rows = getDatabase()
    .prepare(
      `
        SELECT
          id,
          display_name,
          slug,
          visibility,
          source_priority,
          confidence_score,
          updated_at
        FROM people
        ORDER BY source_priority DESC, display_name ASC
      `,
    )
    .all();

  return rows.map(mapPerson);
}

export function getPerson(personId: string) {
  const row = getDatabase()
    .prepare(
      `
        SELECT
          id,
          display_name,
          slug,
          visibility,
          source_priority,
          confidence_score,
          updated_at
        FROM people
        WHERE id = ?
      `,
    )
    .get(personId);

  return row ? mapPerson(row) : null;
}

export function getPersonBySlug(slug: string) {
  const row = getDatabase()
    .prepare(
      `
        SELECT
          id,
          display_name,
          slug,
          visibility,
          source_priority,
          confidence_score,
          updated_at
        FROM people
        WHERE slug = ?
      `,
    )
    .get(slug);

  return row ? mapPerson(row) : null;
}

export function getPersonBySource(
  sourceType: PersonSourceType,
  sourcePersonKey: string,
) {
  const row = getDatabase()
    .prepare(
      `
        SELECT
          p.id,
          p.display_name,
          p.slug,
          p.visibility,
          p.source_priority,
          p.confidence_score,
          p.updated_at
        FROM person_sources ps
        INNER JOIN people p
          ON p.id = ps.person_id
        WHERE ps.source_type = ? AND ps.source_person_key = ?
      `,
    )
    .get(sourceType, sourcePersonKey);

  return row ? mapPerson(row) : null;
}

export function createPerson(input: CreatePersonInput) {
  const displayName = input.displayName.trim();
  const slug = ensureUniquePersonSlug(input.slug ?? slugify(displayName || "person"));
  const id = input.id ?? randomUUID();

  getDatabase()
    .prepare(
      `
        INSERT INTO people (
          id,
          display_name,
          slug,
          visibility,
          source_priority,
          confidence_score
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      id,
      displayName,
      slug,
      input.visibility ?? "private",
      input.sourcePriority ?? 0,
      input.confidenceScore ?? null,
    );

  return getPerson(id)!;
}

export function updatePerson(personId: string, patch: PersonPatch) {
  const assignments: string[] = [];
  const values: Array<number | string | null> = [];

  if (patch.displayName !== undefined) {
    assignments.push("display_name = ?");
    values.push(patch.displayName.trim());
  }

  if (patch.slug !== undefined) {
    assignments.push("slug = ?");
    values.push(ensureUniquePersonSlug(patch.slug, personId));
  }

  if (patch.visibility !== undefined) {
    assignments.push("visibility = ?");
    values.push(patch.visibility);
  }

  if (patch.sourcePriority !== undefined) {
    assignments.push("source_priority = ?");
    values.push(patch.sourcePriority);
  }

  if (patch.confidenceScore !== undefined) {
    assignments.push("confidence_score = ?");
    values.push(patch.confidenceScore);
  }

  if (!assignments.length) {
    return getPerson(personId);
  }

  assignments.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");
  values.push(personId);

  getDatabase()
    .prepare(
      `
        UPDATE people
        SET ${assignments.join(", ")}
        WHERE id = ?
      `,
    )
    .run(...values);

  return getPerson(personId);
}

export function listPersonSources() {
  const rows = getDatabase()
    .prepare(
      `
        SELECT
          id,
          person_id,
          source_type,
          source_person_key,
          source_label,
          confidence_score,
          raw_payload,
          updated_at
        FROM person_sources
        ORDER BY person_id ASC, source_type ASC, source_person_key ASC
      `,
    )
    .all();

  return rows.map(mapPersonSource);
}

export function listPersonSourcesForPersonId(personId: string) {
  const rows = getDatabase()
    .prepare(
      `
        SELECT
          id,
          person_id,
          source_type,
          source_person_key,
          source_label,
          confidence_score,
          raw_payload,
          updated_at
        FROM person_sources
        WHERE person_id = ?
        ORDER BY source_type ASC, source_person_key ASC
      `,
    )
    .all(personId);

  return rows.map(mapPersonSource);
}

export function upsertPersonSource(input: PersonSourceInput) {
  getDatabase()
    .prepare(
      `
        INSERT INTO person_sources (
          person_id,
          source_type,
          source_person_key,
          source_label,
          confidence_score,
          raw_payload
        )
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(source_type, source_person_key) DO UPDATE SET
          person_id = excluded.person_id,
          source_label = excluded.source_label,
          confidence_score = excluded.confidence_score,
          raw_payload = excluded.raw_payload,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      `,
    )
    .run(
      input.personId,
      input.sourceType,
      input.sourcePersonKey,
      input.sourceLabel ?? null,
      input.confidenceScore ?? null,
      input.rawPayload ?? null,
    );
}

export function listAssetPeople() {
  const rows = getDatabase()
    .prepare(
      `
        SELECT
          person_id,
          immich_asset_id,
          source_type,
          source_face_key,
          confidence_score,
          review_state,
          face_left,
          face_top,
          face_width,
          face_height,
          updated_at
        FROM asset_people
      `,
    )
    .all();

  return rows.map(mapAssetPerson);
}

export function listAssetPeopleForAssetIds(assetIds: string[]) {
  if (!assetIds.length) {
    return [];
  }

  const placeholders = assetIds.map(() => "?").join(", ");
  const rows = getDatabase()
    .prepare(
      `
        SELECT
          person_id,
          immich_asset_id,
          source_type,
          source_face_key,
          confidence_score,
          review_state,
          face_left,
          face_top,
          face_width,
          face_height,
          updated_at
        FROM asset_people
        WHERE immich_asset_id IN (${placeholders})
      `,
    )
    .all(...assetIds);

  return rows.map(mapAssetPerson);
}

export function listAssetPeopleForPersonId(personId: string) {
  const rows = getDatabase()
    .prepare(
      `
        SELECT
          person_id,
          immich_asset_id,
          source_type,
          source_face_key,
          confidence_score,
          review_state,
          face_left,
          face_top,
          face_width,
          face_height,
          updated_at
        FROM asset_people
        WHERE person_id = ?
      `,
    )
    .all(personId);

  return rows.map(mapAssetPerson);
}

export function listAdminPeopleForAssetIds(assetIds: string[]) {
  if (!assetIds.length) {
    return [];
  }

  const placeholders = assetIds.map(() => "?").join(", ");
  const rows = getDatabase()
    .prepare(
      `
        SELECT
          ap.immich_asset_id,
          p.id,
          p.display_name,
          p.slug,
          p.visibility,
          ap.confidence_score,
          group_concat(DISTINCT ap.source_type) AS source_types
        FROM asset_people ap
        INNER JOIN people p
          ON p.id = ap.person_id
        WHERE ap.immich_asset_id IN (${placeholders})
          AND ap.review_state != 'rejected'
        GROUP BY ap.immich_asset_id, p.id, p.display_name, p.slug, p.visibility, ap.confidence_score
      `,
    )
    .all(...assetIds);

  return rows.map((row) => ({
    immichAssetId: String(row.immich_asset_id),
    person: {
      id: String(row.id),
      displayName: String(row.display_name),
      slug: String(row.slug),
      visibility: row.visibility as PersonVisibility,
      confidenceScore:
        typeof row.confidence_score === "number" ? row.confidence_score : null,
      sourceTypes: String(row.source_types ?? "")
        .split(",")
        .filter(Boolean) as PersonSourceType[],
    } satisfies AdminAssetPerson,
  }));
}

export function upsertAssetPerson(input: AssetPersonInput) {
  getDatabase()
    .prepare(
      `
        INSERT INTO asset_people (
          person_id,
          immich_asset_id,
          source_type,
          source_face_key,
          confidence_score,
          review_state,
          face_left,
          face_top,
          face_width,
          face_height
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(person_id, immich_asset_id, source_type, source_face_key) DO UPDATE SET
          confidence_score = excluded.confidence_score,
          review_state = excluded.review_state,
          face_left = excluded.face_left,
          face_top = excluded.face_top,
          face_width = excluded.face_width,
          face_height = excluded.face_height,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      `,
    )
    .run(
      input.personId,
      input.immichAssetId,
      input.sourceType,
      input.sourceFaceKey ?? "",
      input.confidenceScore ?? null,
      input.reviewState ?? "approved",
      input.faceBox?.left ?? null,
      input.faceBox?.top ?? null,
      input.faceBox?.width ?? null,
      input.faceBox?.height ?? null,
    );
}

export function mergePeople(personId: string, targetPersonId: string) {
  if (personId === targetPersonId) {
    return getPerson(targetPersonId);
  }

  withTransaction(() => {
    const db = getDatabase();

    db.prepare(
      `
        INSERT INTO person_sources (
          person_id,
          source_type,
          source_person_key,
          source_label,
          confidence_score,
          raw_payload
        )
        SELECT
          ?,
          source_type,
          source_person_key,
          source_label,
          confidence_score,
          raw_payload
        FROM person_sources
        WHERE person_id = ?
        ON CONFLICT(source_type, source_person_key) DO UPDATE SET
          person_id = excluded.person_id,
          source_label = excluded.source_label,
          confidence_score = excluded.confidence_score,
          raw_payload = excluded.raw_payload,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      `,
    ).run(targetPersonId, personId);

    db.prepare(
      `
        INSERT INTO asset_people (
          person_id,
          immich_asset_id,
          source_type,
          source_face_key,
          confidence_score,
          review_state,
          face_left,
          face_top,
          face_width,
          face_height
        )
        SELECT
          ?,
          immich_asset_id,
          source_type,
          source_face_key,
          confidence_score,
          review_state,
          face_left,
          face_top,
          face_width,
          face_height
        FROM asset_people
        WHERE person_id = ?
        ON CONFLICT(person_id, immich_asset_id, source_type, source_face_key) DO UPDATE SET
          confidence_score = COALESCE(excluded.confidence_score, asset_people.confidence_score),
          review_state = CASE
            WHEN excluded.review_state = 'approved' OR asset_people.review_state = 'approved' THEN 'approved'
            WHEN excluded.review_state = 'suggested' OR asset_people.review_state = 'suggested' THEN 'suggested'
            ELSE 'rejected'
          END,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      `,
    ).run(targetPersonId, personId);

    db.prepare("DELETE FROM person_sources WHERE person_id = ?").run(personId);
    db.prepare("DELETE FROM asset_people WHERE person_id = ?").run(personId);
    db.prepare("DELETE FROM people WHERE id = ?").run(personId);
  });

  return getPerson(targetPersonId);
}

function ensureUniquePersonSlug(baseSlug: string, currentPersonId?: string) {
  const cleaned = slugify(baseSlug);
  const existing = listPeople().filter(
    (person) => !currentPersonId || person.id !== currentPersonId,
  );
  const taken = new Set(existing.map((person) => person.slug.toLowerCase()));
  return uniqueSlug(cleaned, taken);
}

function withTransaction(callback: () => void) {
  const db = getDatabase();
  db.exec("BEGIN");

  try {
    callback();
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function mapAlbumConfig(row: Record<string, unknown>): PortfolioAlbumConfig {
  return {
    immichAlbumId: String(row.immich_album_id),
    slug: String(row.slug),
    visibility: row.visibility as PortfolioAlbumConfig["visibility"],
    featured: Boolean(row.featured),
    sortOrder: Number(row.sort_order),
    coverAssetId: nullableString(row.cover_asset_id),
    titleOverride: nullableString(row.title_override),
    descriptionOverride: nullableString(row.description_override),
    shareUrl: nullableString(row.share_url),
    updatedAt: String(row.updated_at),
    immichTitle: nullableString(row.immich_title),
    immichDescription: nullableString(row.immich_description),
    immichThumbnailAssetId: nullableString(row.immich_thumbnail_asset_id),
    immichStartDate: nullableString(row.immich_start_date),
    category: (row.category as PortfolioAlbumConfig["category"]) ?? null,
  };
}

function mapAssetConfig(row: Record<string, unknown>): PortfolioAssetConfig {
  return {
    immichAssetId: String(row.immich_asset_id),
    albumId: String(row.album_id),
    visibility: row.visibility as PortfolioAssetConfig["visibility"],
    featured: Boolean(row.featured),
    sortOrder: Number(row.sort_order),
    allowDownload: Boolean(row.allow_download),
    titleOverride: nullableString(row.title_override),
    descriptionOverride: nullableString(row.description_override),
    updatedAt: String(row.updated_at),
  };
}

function mapAssetAnnotation(row: Record<string, unknown>): AssetAnnotation {
  return {
    immichAssetId: String(row.immich_asset_id),
    primaryGenre: nullableGenre(row.primary_genre),
    secondaryGenre: nullableGenre(row.secondary_genre),
    portfolioRole: row.portfolio_role as PortfolioRole,
    aiScore: nullableNumber(row.ai_score),
    semanticScore: nullableNumber(row.semantic_score),
    aestheticScore: nullableNumber(row.aesthetic_score),
    technicalScore: nullableNumber(row.technical_score),
    uniquenessScore: nullableNumber(row.uniqueness_score),
    genreConfidence: nullableNumber(row.genre_confidence),
    duplicateClusterId: nullableString(row.duplicate_cluster_id),
    aiSummary: nullableString(row.ai_summary),
    aiTags: parseJsonStringArray(row.ai_tags_json),
    aiProvider: nullableString(row.ai_provider),
    aiModel: nullableString(row.ai_model),
    aiProcessedAt: nullableString(row.ai_processed_at),
    exportCandidate: Boolean(row.export_candidate),
    reviewState: row.review_state as ReviewState,
    manifestPath: nullableString(row.manifest_path),
    updatedAt: String(row.updated_at),
  };
}

function mapPerson(row: Record<string, unknown>): Person {
  return {
    id: String(row.id),
    displayName: String(row.display_name),
    slug: String(row.slug),
    visibility: row.visibility as PersonVisibility,
    sourcePriority: Number(row.source_priority),
    confidenceScore: nullableNumber(row.confidence_score),
    updatedAt: String(row.updated_at),
  };
}

function mapPersonSource(row: Record<string, unknown>): PersonSource {
  return {
    id: Number(row.id),
    personId: String(row.person_id),
    sourceType: row.source_type as PersonSourceType,
    sourcePersonKey: String(row.source_person_key),
    sourceLabel: nullableString(row.source_label),
    confidenceScore: nullableNumber(row.confidence_score),
    rawPayload: nullableString(row.raw_payload),
    updatedAt: String(row.updated_at),
  };
}

function mapAssetPerson(row: Record<string, unknown>): AssetPerson {
  const left = nullableNumber(row.face_left);
  const top = nullableNumber(row.face_top);
  const width = nullableNumber(row.face_width);
  const height = nullableNumber(row.face_height);

  return {
    personId: String(row.person_id),
    immichAssetId: String(row.immich_asset_id),
    sourceType: row.source_type as PersonSourceType,
    sourceFaceKey: String(row.source_face_key ?? ""),
    confidenceScore: nullableNumber(row.confidence_score),
    reviewState: row.review_state as ReviewState,
    faceBox:
      left === null || top === null || width === null || height === null
        ? null
        : { left, top, width, height },
    updatedAt: String(row.updated_at),
  };
}

function mapAssetAssociation(row: Record<string, unknown>): AssetAssociation {
  return {
    immichAssetId: String(row.immich_asset_id),
    albumId: String(row.album_id),
    albumSlug: String(row.album_slug),
    albumVisibility: row.album_visibility as AssetAssociation["albumVisibility"],
    assetVisibility: row.asset_visibility as AssetAssociation["assetVisibility"],
    allowDownload: Boolean(row.allow_download),
    featured: Boolean(row.featured),
    sortOrder: Number(row.sort_order),
    titleOverride: nullableString(row.title_override),
    descriptionOverride: nullableString(row.description_override),
    shareUrl: nullableString(row.share_url),
  };
}

function nullableGenre(value: unknown) {
  return typeof value === "string" && value.trim()
    ? (value as PortfolioGenre)
    : null;
}

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nullableString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  return value.trim() ? value : null;
}

function parseJsonStringArray(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim());
  } catch {
    return [];
  }
}
