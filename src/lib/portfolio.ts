import {
  ensureAssetAnnotations,
  getAlbumConfigBySlug,
  getAssetAnnotation,
  getPersonBySlug,
  listAdminPeopleForAssetIds,
  listAlbumConfigs,
  listAssetAnnotationsForAssetIds,
  listAssetAssociations,
  listAssetAssociationsForAlbum,
  listAssetAssociationsForAsset,
  listAssetAssociationsForAssetIds,
  listAssetConfigsForAlbum,
  listAssetPeople,
  listAssetPeopleForAssetIds,
  listAssetPeopleForPersonId,
  listPeople,
  listPersonSources,
  syncAssetMembership,
  updateAlbumConfig,
  updateAssetAnnotation,
  updateAssetConfig,
  upsertAlbumDefaults,
} from "@/lib/db";
import { GENRE_CONTENT, SIGNATURE_GENRES, SPECIALTY_GENRES } from "@/lib/catalog";
import { getPortfolioEnv } from "@/lib/env";
import {
  checkImmichConnection,
  getImmichAlbum,
  getImmichAsset,
  listImmichAlbums,
  searchImmichSmart,
} from "@/lib/immich";
import { slugify, uniqueSlug } from "@/lib/slug";
import type {
  AdminAlbumSummary,
  AdminAssetSummary,
  AdminDashboardData,
  AdminPersonSummary,
  AssetAnnotation,
  HomePageData,
  ImmichAlbum,
  ImmichAsset,
  PortfolioAlbumConfig,
  PortfolioAssetConfig,
  PortfolioGenre,
  PortfolioRole,
  PersonSourceType,
  PublicAlbum,
  PublicAsset,
  PublicAssetPerson,
  PublicPersonDetail,
  PublicPersonSummary,
  PublicSearchResult,
  ReviewState,
} from "@/lib/types";
import {
  getVisibleAssociations,
  pickPrimaryAssociation,
  type AssetAssociation,
} from "@/lib/visibility";

const DEFAULT_ANNOTATION: AssetAnnotation = {
  immichAssetId: "",
  primaryGenre: null,
  secondaryGenre: null,
  portfolioRole: "archive",
  aiScore: null,
  semanticScore: null,
  aestheticScore: null,
  technicalScore: null,
  uniquenessScore: null,
  genreConfidence: null,
  duplicateClusterId: null,
  aiSummary: null,
  aiTags: [],
  aiProvider: null,
  aiModel: null,
  aiProcessedAt: null,
  exportCandidate: false,
  reviewState: "suggested",
  manifestPath: null,
  updatedAt: "",
};

interface PortfolioAssetQuery {
  genres?: PortfolioGenre[];
  limit?: number;
  reviewStates?: ReviewState[];
  roles?: PortfolioRole[];
}

export async function getHomePageData() {
  const publicAlbums = await getPublicAlbums();
  const featuredAlbums = publicAlbums.filter((album) => album.featured);
  const signatureAssets = await getPortfolioAssets({
    genres: [...SIGNATURE_GENRES],
    roles: ["signature"],
    reviewStates: ["approved"],
    limit: 9,
  });

  return {
    featuredAlbums:
      (featuredAlbums.length ? featuredAlbums : publicAlbums).slice(0, 3),
    featuredPeople: (await getPublicPeople()).slice(0, 4),
    signatureAssets:
      signatureAssets.length > 0
        ? signatureAssets
        : await getFallbackFeaturedAssets(9),
    specialtySections: (
      await Promise.all(
        SPECIALTY_GENRES.map(async (genre) => ({
          assets: await getPortfolioAssets({
            genres: [genre],
            reviewStates: ["approved"],
            limit: 4,
          }),
          description: GENRE_CONTENT[genre].description,
          genre,
          href: `/work/${genre}`,
          title: GENRE_CONTENT[genre].title,
        })),
      )
    ).filter((section) => section.assets.length),
  } satisfies HomePageData;
}

export async function getPublicAlbums() {
  const env = getPortfolioEnv();
  if (!env.hasImmichConfig) {
    return [] satisfies PublicAlbum[];
  }

  const [configs, immichAlbums] = await Promise.all([
    Promise.resolve(listAlbumConfigs()),
    listImmichAlbums(),
  ]);

  const visibleCounts = countVisibleAssetsByAlbum(listAssetAssociations());
  const immichById = new Map(immichAlbums.map((album) => [album.id, album]));

  return configs
    .filter((config) => config.visibility === "public")
    .map((config) => {
      const album = immichById.get(config.immichAlbumId);
      if (!album) {
        return null;
      }

      return buildPublicAlbumSummary(
        config,
        album,
        visibleCounts.get(config.immichAlbumId) ?? 0,
      );
    })
    .filter((value): value is PublicAlbum => Boolean(value))
    .sort(sortAlbumSummaries);
}

export async function getPublicAlbumBySlug(slug: string) {
  const config = getAlbumConfigBySlug(slug);
  if (!config || config.visibility !== "public") {
    return null;
  }

  const album = await getImmichAlbum(config.immichAlbumId);
  const associationMap = groupAssociationsByAssetId(
    listAssetAssociationsForAlbum(config.immichAlbumId),
  );
  const assetIds =
    album.assets
      ?.filter(isPhotoAsset)
      .filter((asset) => getVisibleAssociations(associationMap.get(asset.id) ?? []).length)
      .map((asset) => asset.id) ?? [];
  const annotationMap = mapAssetAnnotations(assetIds);
  const peopleMap = mapPublicPeopleForAssets(assetIds);

  const assets =
    album.assets
      ?.filter(isPhotoAsset)
      .map((asset) => {
        const visibleAssociations = getVisibleAssociations(
          associationMap.get(asset.id) ?? [],
        );

        if (!visibleAssociations.length) {
          return null;
        }

        return buildPublicAsset(asset, visibleAssociations, {
          annotation: annotationMap.get(asset.id),
          people: peopleMap.get(asset.id) ?? [],
        });
      })
      .filter((value): value is PublicAsset => Boolean(value))
      .sort(sortPublicAssets) ?? [];

  return {
    ...buildPublicAlbumSummary(config, album, assets.length),
    coverAssetId:
      config.coverAssetId ?? album.albumThumbnailAssetId ?? assets[0]?.id ?? null,
    assets,
  } satisfies PublicAlbum;
}

export async function getPublicAssetById(assetId: string) {
  const visibleAssociations = getVisibleAssociations(
    listAssetAssociationsForAsset(assetId),
  );

  if (!visibleAssociations.length) {
    return null;
  }

  const asset = await getImmichAsset(assetId);
  return buildPublicAsset(asset, visibleAssociations, {
    annotation: getAssetAnnotation(assetId),
    people: mapPublicPeopleForAssets([assetId]).get(assetId) ?? [],
  });
}

export async function searchPublicAssets(query: string) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [] satisfies PublicSearchResult[];
  }

  const hits = await searchImmichSmart(trimmedQuery);
  const associationMap = groupAssociationsByAssetId(
    listAssetAssociationsForAssetIds(hits.map((hit) => hit.asset.id)),
  );
  const assetIds = hits.map((hit) => hit.asset.id);
  const annotationMap = mapAssetAnnotations(assetIds);
  const peopleMap = mapPublicPeopleForAssets(assetIds);

  return hits
    .map((hit) => {
      const visibleAssociations = getVisibleAssociations(
        associationMap.get(hit.asset.id) ?? [],
      );

      if (!visibleAssociations.length || !isPhotoAsset(hit.asset)) {
        return null;
      }

      const asset = buildPublicAsset(hit.asset, visibleAssociations, {
        annotation: annotationMap.get(hit.asset.id),
        people: peopleMap.get(hit.asset.id) ?? [],
      });

      return {
        assetId: asset.id,
        score: hit.score,
        matchedBy: hit.matchedBy,
        publicAlbumSlugs: asset.publicAlbumSlugs,
        asset,
      } satisfies PublicSearchResult;
    })
    .filter((value): value is PublicSearchResult => Boolean(value));
}

export async function getPublicAssetsByGenre(genre: PortfolioGenre) {
  return getPortfolioAssets({
    genres: [genre],
    reviewStates: ["approved"],
    limit: 120,
  });
}

export async function getPublicPeople() {
  const visibleAssociationMap = getVisibleAssociationMap();
  const visibleAssetIds = new Set(visibleAssociationMap.keys());
  const people = listPeople().filter((person) => person.visibility === "public");
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const publicLinks = listAssetPeople().filter(
    (link) =>
      link.reviewState === "approved" &&
      visibleAssetIds.has(link.immichAssetId) &&
      peopleById.has(link.personId),
  );

  const annotationMap = mapAssetAnnotations(publicLinks.map((link) => link.immichAssetId));
  const assetIdsByPerson = new Map<string, Set<string>>();

  for (const link of publicLinks) {
    const current = assetIdsByPerson.get(link.personId) ?? new Set<string>();
    current.add(link.immichAssetId);
    assetIdsByPerson.set(link.personId, current);
  }

  const summaries: PublicPersonSummary[] = [];

  for (const person of people) {
    const summary = buildPublicPersonSummary(
      person,
      [...(assetIdsByPerson.get(person.id) ?? new Set())],
      annotationMap,
      visibleAssociationMap,
    );

    if (summary) {
      summaries.push(summary);
    }
  }

  return summaries.sort(sortPeople);
}

export async function getPublicPersonBySlug(slug: string) {
  const person = getPersonBySlug(slug);
  if (!person || person.visibility !== "public") {
    return null;
  }

  const visibleAssociationMap = getVisibleAssociationMap();
  const assetIds = [...new Set(
    listAssetPeopleForPersonId(person.id)
      .filter(
        (link) =>
          link.reviewState === "approved" &&
          visibleAssociationMap.has(link.immichAssetId),
      )
      .map((link) => link.immichAssetId),
  )];

  const annotationMap = mapAssetAnnotations(assetIds);
  const assets = await loadPublicAssets(assetIds, visibleAssociationMap, annotationMap);

  return {
    assets,
    person: buildPublicPersonSummary(
      person,
      assetIds,
      annotationMap,
      visibleAssociationMap,
    )!,
  } satisfies PublicPersonDetail;
}

export async function getAdminDashboardData(selectedAlbumId?: string | null) {
  const env = getPortfolioEnv();

  if (!env.hasImmichConfig) {
    return {
      status: {
        hasImmichConfig: false,
        connected: false,
        message:
          "Set IMMICH_URL and IMMICH_API_KEY to import albums from your Immich server.",
      },
      albums: [],
      people: [],
      selectedAlbumId: null,
      selectedAlbumAssets: [],
    } satisfies AdminDashboardData;
  }

  const [connection, immichAlbums] = await Promise.all([
    checkImmichConnection(),
    listImmichAlbums().catch(() => []),
  ]);

  const configs = listAlbumConfigs();
  const counts = countVisibleAssetsByAlbum(listAssetAssociations());
  const immichById = new Map(immichAlbums.map((album) => [album.id, album]));

  const albums = configs
    .map((config) => {
      const album = immichById.get(config.immichAlbumId);
      if (!album) {
        return null;
      }

      return buildAdminAlbumSummary(
        config,
        album,
        counts.get(config.immichAlbumId) ?? 0,
      );
    })
    .filter((value): value is AdminAlbumSummary => Boolean(value))
    .sort(sortAdminAlbums);

  const activeAlbumId = selectedAlbumId ?? albums[0]?.id ?? null;

  return {
    status: {
      hasImmichConfig: true,
      connected: connection.connected,
      message: connection.message,
    },
    albums,
    people: getAdminPeople(),
    selectedAlbumId: activeAlbumId,
    selectedAlbumAssets: activeAlbumId ? await getAdminAssetRows(activeAlbumId) : [],
  } satisfies AdminDashboardData;
}

export async function syncPortfolioFromImmich() {
  const existingConfigs = listAlbumConfigs();
  const existingConfigMap = new Map(
    existingConfigs.map((config) => [config.immichAlbumId, config]),
  );
  const takenSlugs = new Set(
    existingConfigs.map((config) => config.slug.toLowerCase()),
  );

  const albums = await listImmichAlbums();
  let assetMembershipCount = 0;

  for (const album of albums) {
    const existing = existingConfigMap.get(album.id);
    const nextSlug = existing
      ? existing.slug
      : uniqueSlug(slugify(album.albumName), takenSlugs);

    upsertAlbumDefaults({
      immichAlbumId: album.id,
      slug: nextSlug,
      coverAssetId: album.albumThumbnailAssetId ?? null,
    });
    takenSlugs.add(nextSlug.toLowerCase());
  }

  for (const album of albums) {
    const detail = await getImmichAlbum(album.id);
    const photoAssetIds =
      detail.assets?.filter(isPhotoAsset).map((asset) => asset.id) ?? [];
    syncAssetMembership(album.id, photoAssetIds);
    ensureAssetAnnotations(photoAssetIds);
    assetMembershipCount += photoAssetIds.length;
  }

  return {
    syncedAt: new Date().toISOString(),
    albumCount: albums.length,
    assetMembershipCount,
  };
}

export function patchAlbumConfig(
  immichAlbumId: string,
  patch: Partial<PortfolioAlbumConfig>,
) {
  return updateAlbumConfig(immichAlbumId, {
    slug: patch.slug,
    visibility: patch.visibility,
    featured: patch.featured,
    sortOrder: patch.sortOrder,
    coverAssetId: patch.coverAssetId,
    titleOverride: patch.titleOverride,
    descriptionOverride: patch.descriptionOverride,
    shareUrl: patch.shareUrl,
  });
}

export function patchAssetConfig(
  assetId: string,
  albumId: string,
  patch: Partial<PortfolioAssetConfig> &
    Partial<
      Pick<
        AssetAnnotation,
        "primaryGenre" | "secondaryGenre" | "portfolioRole" | "reviewState"
      >
    >,
) {
  updateAssetConfig(assetId, albumId, {
    visibility: patch.visibility,
    featured: patch.featured,
    sortOrder: patch.sortOrder,
    allowDownload: patch.allowDownload,
    titleOverride: patch.titleOverride,
    descriptionOverride: patch.descriptionOverride,
  });

  updateAssetAnnotation(assetId, {
    primaryGenre: patch.primaryGenre,
    secondaryGenre: patch.secondaryGenre,
    portfolioRole: patch.portfolioRole,
    reviewState: patch.reviewState,
  });
}

async function getPortfolioAssets(query: PortfolioAssetQuery) {
  const associationMap = getVisibleAssociationMap();
  const visibleAssetIds = [...associationMap.keys()];
  const annotationMap = mapAssetAnnotations(visibleAssetIds);
  const candidateIds = visibleAssetIds
    .filter((assetId) => {
      const annotation = annotationMap.get(assetId) ?? DEFAULT_ANNOTATION;
      if (
        query.reviewStates?.length &&
        !query.reviewStates.includes(annotation.reviewState)
      ) {
        return false;
      }

      if (
        query.roles?.length &&
        !query.roles.includes(annotation.portfolioRole)
      ) {
        return false;
      }

      if (!query.genres?.length) {
        return true;
      }

      return (
        (annotation.primaryGenre
          ? query.genres.includes(annotation.primaryGenre)
          : false) ||
        (annotation.secondaryGenre
          ? query.genres.includes(annotation.secondaryGenre)
          : false)
      );
    })
    .sort((a, b) => compareAssetIds(a, b, annotationMap, associationMap))
    .slice(0, query.limit ?? visibleAssetIds.length);

  return loadPublicAssets(candidateIds, associationMap, annotationMap);
}

async function getFallbackFeaturedAssets(limit: number) {
  const associationMap = getVisibleAssociationMap();
  const assetIds = [...associationMap.keys()]
    .filter((assetId) =>
      (associationMap.get(assetId) ?? []).some((association) => association.featured),
    )
    .slice(0, limit);
  const annotationMap = mapAssetAnnotations(assetIds);

  return loadPublicAssets(assetIds, associationMap, annotationMap);
}

async function loadPublicAssets(
  assetIds: string[],
  associationMap: Map<string, AssetAssociation[]>,
  annotationMap = mapAssetAnnotations(assetIds),
) {
  if (!assetIds.length) {
    return [] satisfies PublicAsset[];
  }

  const peopleMap = mapPublicPeopleForAssets(assetIds);
  const assets = await Promise.all(
    assetIds.map(async (assetId) => {
      const visibleAssociations = getVisibleAssociations(
        associationMap.get(assetId) ?? [],
      );
      if (!visibleAssociations.length) {
        return null;
      }

      const asset = await getImmichAsset(assetId);
      return buildPublicAsset(asset, visibleAssociations, {
        annotation: annotationMap.get(assetId),
        people: peopleMap.get(assetId) ?? [],
      });
    }),
  );

  return assets.filter((value): value is PublicAsset => Boolean(value));
}

async function getAdminAssetRows(albumId: string) {
  const [album, assetConfigs] = await Promise.all([
    getImmichAlbum(albumId),
    Promise.resolve(listAssetConfigsForAlbum(albumId)),
  ]);
  const configMap = new Map(assetConfigs.map((config) => [config.immichAssetId, config]));
  const assetIds = album.assets?.filter(isPhotoAsset).map((asset) => asset.id) ?? [];
  const annotationMap = mapAssetAnnotations(assetIds);
  const associations = groupAssociationsByAssetId(listAssetAssociationsForAssetIds(assetIds));
  const linkedPeople = groupAdminPeopleByAssetId(assetIds);
  const publicPeople = mapPublicPeopleForAssets(assetIds);

  return (
    album.assets
      ?.filter(isPhotoAsset)
      .map((asset) => {
        const config = configMap.get(asset.id) ?? null;
        const publicAsset = buildPublicAsset(
          asset,
          getVisibleAssociations(associations.get(asset.id) ?? []),
          {
            annotation: annotationMap.get(asset.id),
            explicitConfig: config,
            people: publicPeople.get(asset.id) ?? [],
          },
        );
        const annotation = annotationMap.get(asset.id) ?? DEFAULT_ANNOTATION;

        return {
          ...publicAsset,
          albumId,
          visibility: config?.visibility ?? "inherit",
          sortOrder: config?.sortOrder ?? 0,
          titleOverride: config?.titleOverride ?? null,
          descriptionOverride: config?.descriptionOverride ?? null,
          aiSummary: annotation.aiSummary,
          aiTags: annotation.aiTags,
          aiProvider: annotation.aiProvider,
          aiModel: annotation.aiModel,
          aiProcessedAt: annotation.aiProcessedAt,
          exportCandidate: annotation.exportCandidate,
          semanticScore: annotation.semanticScore,
          aestheticScore: annotation.aestheticScore,
          technicalScore: annotation.technicalScore,
          uniquenessScore: annotation.uniquenessScore,
          genreConfidence: annotation.genreConfidence,
          duplicateClusterId: annotation.duplicateClusterId,
          linkedPeople: linkedPeople.get(asset.id) ?? [],
        } satisfies AdminAssetSummary;
      })
      .sort(
        (a, b) =>
          Number(b.featured) - Number(a.featured) || a.sortOrder - b.sortOrder,
      ) ?? []
  );
}

function getAdminPeople(): AdminPersonSummary[] {
  const visibleAssociationMap = getVisibleAssociationMap();
  const visibleAssetIds = new Set(visibleAssociationMap.keys());
  const links = listAssetPeople().filter((link) => link.reviewState !== "rejected");
  const sources = listPersonSources();
  const sourceCountByPerson = new Map<string, number>();
  const sourceTypesByPerson = new Map<string, Set<PersonSourceType>>();
  const assetIdsByPerson = new Map<string, Set<string>>();
  const publicAssetIdsByPerson = new Map<string, Set<string>>();

  for (const source of sources) {
    sourceCountByPerson.set(
      source.personId,
      (sourceCountByPerson.get(source.personId) ?? 0) + 1,
    );
    const currentTypes =
      sourceTypesByPerson.get(source.personId) ?? new Set<PersonSourceType>();
    currentTypes.add(source.sourceType);
    sourceTypesByPerson.set(source.personId, currentTypes);
  }

  for (const link of links) {
    const currentAssets = assetIdsByPerson.get(link.personId) ?? new Set<string>();
    currentAssets.add(link.immichAssetId);
    assetIdsByPerson.set(link.personId, currentAssets);

    if (visibleAssetIds.has(link.immichAssetId)) {
      const publicAssets = publicAssetIdsByPerson.get(link.personId) ?? new Set<string>();
      publicAssets.add(link.immichAssetId);
      publicAssetIdsByPerson.set(link.personId, publicAssets);
    }
  }

  const annotationMap = mapAssetAnnotations(
    links.map((link) => link.immichAssetId),
  );

  return listPeople()
    .map((person) => {
      const assetIds = [...(publicAssetIdsByPerson.get(person.id) ?? new Set<string>())];

      return {
        ...person,
        assetCount: (assetIdsByPerson.get(person.id) ?? new Set()).size,
        coverAssetId: pickCoverAssetId(assetIds, annotationMap, visibleAssociationMap),
        publicAssetCount: assetIds.length,
        sourceCount: sourceCountByPerson.get(person.id) ?? 0,
        sourceTypes: [
          ...(sourceTypesByPerson.get(person.id) ?? new Set<PersonSourceType>()),
        ],
      } satisfies AdminPersonSummary;
    })
    .sort(sortAdminPeople);
}

function buildPublicAlbumSummary(
  config: PortfolioAlbumConfig,
  album: ImmichAlbum,
  assetCount: number,
) {
  return {
    id: album.id,
    slug: config.slug,
    title: config.titleOverride ?? album.albumName,
    description: config.descriptionOverride ?? album.description ?? null,
    coverAssetId:
      config.coverAssetId ?? album.albumThumbnailAssetId ?? album.assets?.[0]?.id ?? null,
    assetCount,
    featured: config.featured,
    sortOrder: config.sortOrder,
    shareUrl: config.shareUrl,
  } satisfies PublicAlbum;
}

function buildAdminAlbumSummary(
  config: PortfolioAlbumConfig,
  album: ImmichAlbum,
  assetCount: number,
) {
  return {
    ...buildPublicAlbumSummary(config, album, assetCount),
    visibility: config.visibility,
    immichTitle: album.albumName,
    immichDescription: album.description ?? null,
  } satisfies AdminAlbumSummary;
}

function buildPublicAsset(
  asset: ImmichAsset,
  visibleAssociations: AssetAssociation[],
  options: {
    annotation?: AssetAnnotation | null;
    explicitConfig?: PortfolioAssetConfig | null;
    people?: PublicAssetPerson[];
  } = {},
) {
  const primaryAssociation =
    pickPrimaryAssociation(visibleAssociations) ??
    visibleAssociations[0] ??
    null;
  const fallbackTitle = asset.originalFileName.replace(/\.[^.]+$/, "");
  const allowDownload =
    primaryAssociation?.allowDownload ??
    options.explicitConfig?.allowDownload ??
    false;
  const annotation = options.annotation ?? DEFAULT_ANNOTATION;

  return {
    id: asset.id,
    originalFileName: asset.originalFileName,
    title:
      primaryAssociation?.titleOverride ??
      options.explicitConfig?.titleOverride ??
      fallbackTitle,
    description:
      primaryAssociation?.descriptionOverride ??
      options.explicitConfig?.descriptionOverride ??
      asset.exifInfo?.description ??
      null,
    captureAt:
      asset.exifInfo?.dateTimeOriginal ??
      asset.localDateTime ??
      asset.fileCreatedAt ??
      null,
    cameraLabel: buildCameraLabel(asset),
    lensLabel: asset.exifInfo?.lensModel ?? null,
    locationLabel: buildLocationLabel(asset),
    exifInfo: asset.exifInfo ?? null,
    publicAlbumSlugs: visibleAssociations
      .filter((association) => association.albumVisibility === "public")
      .map((association) => association.albumSlug),
    featured:
      primaryAssociation?.featured ?? options.explicitConfig?.featured ?? false,
    allowDownload,
    thumbUrl: `/api/media/${asset.id}/thumb?size=thumbnail`,
    previewUrl: `/api/media/${asset.id}/thumb?size=preview`,
    downloadUrl: allowDownload ? `/api/media/${asset.id}/original` : null,
    primaryGenre: annotation.primaryGenre,
    secondaryGenre: annotation.secondaryGenre,
    portfolioRole: annotation.portfolioRole,
    reviewState: annotation.reviewState,
    aiScore: annotation.aiScore,
    people: options.people ?? [],
  } satisfies PublicAsset;
}

function buildPublicPersonSummary(
  person: ReturnType<typeof listPeople>[number],
  assetIds: string[],
  annotationMap: Map<string, AssetAnnotation>,
  associationMap: Map<string, AssetAssociation[]>,
): PublicPersonSummary | null {
  if (!assetIds.length) {
    return null;
  }

  return {
    assetCount: assetIds.length,
    confidenceScore: person.confidenceScore,
    coverAssetId: pickCoverAssetId(assetIds, annotationMap, associationMap),
    displayName: person.displayName,
    href: `/people/${person.slug}`,
    id: person.id,
    slug: person.slug,
  } satisfies PublicPersonSummary;
}

function countVisibleAssetsByAlbum(associations: AssetAssociation[]) {
  const counts = new Map<string, number>();

  for (const association of associations) {
    if (!getVisibleAssociations([association]).length) {
      continue;
    }

    counts.set(
      association.albumId,
      (counts.get(association.albumId) ?? 0) + 1,
    );
  }

  return counts;
}

function getVisibleAssociationMap() {
  const grouped = groupAssociationsByAssetId(listAssetAssociations());
  const visible = new Map<string, AssetAssociation[]>();

  for (const [assetId, associations] of grouped.entries()) {
    const visibleAssociations = getVisibleAssociations(associations);
    if (visibleAssociations.length) {
      visible.set(assetId, visibleAssociations);
    }
  }

  return visible;
}

function groupAssociationsByAssetId(associations: AssetAssociation[]) {
  const map = new Map<string, AssetAssociation[]>();

  for (const association of associations) {
    const current = map.get(association.immichAssetId) ?? [];
    current.push(association);
    map.set(association.immichAssetId, current);
  }

  return map;
}

function mapAssetAnnotations(assetIds: string[]) {
  const map = new Map<string, AssetAnnotation>();

  for (const annotation of listAssetAnnotationsForAssetIds(assetIds)) {
    map.set(annotation.immichAssetId, annotation);
  }

  return map;
}

function mapPublicPeopleForAssets(assetIds: string[]) {
  const peopleById = new Map(listPeople().map((person) => [person.id, person]));
  const grouped = new Map<string, Map<string, PublicAssetPerson>>();

  for (const link of listAssetPeopleForAssetIds(assetIds)) {
    if (link.reviewState !== "approved") {
      continue;
    }

    const person = peopleById.get(link.personId);
    if (!person || person.visibility !== "public") {
      continue;
    }

    const assetPeople = grouped.get(link.immichAssetId) ?? new Map<string, PublicAssetPerson>();
    const current = assetPeople.get(person.id);
    const nextConfidence =
      current?.confidenceScore === null || current?.confidenceScore === undefined
        ? link.confidenceScore
        : Math.max(current.confidenceScore, link.confidenceScore ?? 0);

    assetPeople.set(person.id, {
      confidenceScore: nextConfidence ?? null,
      displayName: person.displayName,
      faceBox: link.faceBox,
      href: `/people/${person.slug}`,
      id: person.id,
      slug: person.slug,
    });
    grouped.set(link.immichAssetId, assetPeople);
  }

  return new Map(
    [...grouped.entries()].map(([assetId, people]) => [
      assetId,
      [...people.values()].sort(
        (a, b) =>
          (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0) ||
          a.displayName.localeCompare(b.displayName),
      ),
    ]),
  );
}

function groupAdminPeopleByAssetId(assetIds: string[]) {
  const grouped = new Map<string, AdminAssetSummary["linkedPeople"]>();

  for (const row of listAdminPeopleForAssetIds(assetIds)) {
    const current = grouped.get(row.immichAssetId) ?? [];
    current.push(row.person);
    grouped.set(
      row.immichAssetId,
      current.sort(
        (a, b) =>
          visibilityRank(b.visibility) - visibilityRank(a.visibility) ||
          (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0) ||
          a.displayName.localeCompare(b.displayName),
      ),
    );
  }

  return grouped;
}

function pickCoverAssetId(
  assetIds: string[],
  annotationMap: Map<string, AssetAnnotation>,
  associationMap: Map<string, AssetAssociation[]>,
) {
  return [...assetIds]
    .sort((a, b) => compareAssetIds(a, b, annotationMap, associationMap))[0] ?? null;
}

function compareAssetIds(
  a: string,
  b: string,
  annotationMap: Map<string, AssetAnnotation>,
  associationMap: Map<string, AssetAssociation[]>,
) {
  const annotationA = annotationMap.get(a) ?? DEFAULT_ANNOTATION;
  const annotationB = annotationMap.get(b) ?? DEFAULT_ANNOTATION;
  const associationA = pickPrimaryAssociation(
    getVisibleAssociations(associationMap.get(a) ?? []),
  );
  const associationB = pickPrimaryAssociation(
    getVisibleAssociations(associationMap.get(b) ?? []),
  );

  return (
    Number(annotationB.portfolioRole === "signature") -
      Number(annotationA.portfolioRole === "signature") ||
    (annotationB.aiScore ?? 0) - (annotationA.aiScore ?? 0) ||
    Number(associationB?.featured) - Number(associationA?.featured) ||
    (associationA?.sortOrder ?? 0) - (associationB?.sortOrder ?? 0) ||
    a.localeCompare(b)
  );
}

function sortAlbumSummaries(a: PublicAlbum, b: PublicAlbum) {
  return (
    Number(b.featured) - Number(a.featured) ||
    a.sortOrder - b.sortOrder ||
    a.title.localeCompare(b.title)
  );
}

function sortAdminAlbums(a: AdminAlbumSummary, b: AdminAlbumSummary) {
  return sortAlbumSummaries(a, b);
}

function sortPublicAssets(a: PublicAsset, b: PublicAsset) {
  const aDate = a.captureAt ? new Date(a.captureAt).getTime() : 0;
  const bDate = b.captureAt ? new Date(b.captureAt).getTime() : 0;

  return (
    Number(b.featured) - Number(a.featured) ||
    (b.aiScore ?? 0) - (a.aiScore ?? 0) ||
    bDate - aDate ||
    a.title.localeCompare(b.title)
  );
}

function sortPeople(a: PublicPersonSummary, b: PublicPersonSummary) {
  return (
    b.assetCount - a.assetCount ||
    (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0) ||
    a.displayName.localeCompare(b.displayName)
  );
}

function sortAdminPeople(a: AdminPersonSummary, b: AdminPersonSummary) {
  return (
    visibilityRank(b.visibility) - visibilityRank(a.visibility) ||
    b.publicAssetCount - a.publicAssetCount ||
    b.assetCount - a.assetCount ||
    a.displayName.localeCompare(b.displayName)
  );
}

function visibilityRank(value: AdminPersonSummary["visibility"]) {
  if (value === "public") {
    return 2;
  }

  if (value === "private") {
    return 1;
  }

  return 0;
}

function isPhotoAsset(asset: ImmichAsset) {
  return asset.type !== "VIDEO";
}

function buildCameraLabel(asset: ImmichAsset) {
  const label = [asset.exifInfo?.make, asset.exifInfo?.model]
    .filter(Boolean)
    .join(" ");
  return label || null;
}

function buildLocationLabel(asset: ImmichAsset) {
  const parts = [
    asset.exifInfo?.city,
    asset.exifInfo?.state,
    asset.exifInfo?.country,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}
