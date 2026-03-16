export const PORTFOLIO_GENRES = [
  "landscape",
  "street",
  "wildlife",
  "event",
  "product",
  "sports",
  "film",
  "other",
] as const;

export const PORTFOLIO_ROLES = [
  "signature",
  "specialty",
  "archive",
  "hidden",
] as const;

export const REVIEW_STATES = ["suggested", "approved", "rejected"] as const;
export const PERSON_VISIBILITIES = ["public", "private", "hidden"] as const;
export const PERSON_SOURCE_TYPES = ["lightroom", "immich", "manual"] as const;

export type PortfolioGenre = (typeof PORTFOLIO_GENRES)[number];
export type PortfolioRole = (typeof PORTFOLIO_ROLES)[number];
export type ReviewState = (typeof REVIEW_STATES)[number];
export type PersonVisibility = (typeof PERSON_VISIBILITIES)[number];
export type PersonSourceType = (typeof PERSON_SOURCE_TYPES)[number];
export type PortfolioVisibility = "private" | "public";
export type PortfolioAssetVisibility = "inherit" | "private" | "public";

export interface PortfolioAlbumConfig {
  immichAlbumId: string;
  slug: string;
  visibility: PortfolioVisibility;
  featured: boolean;
  sortOrder: number;
  coverAssetId: string | null;
  titleOverride: string | null;
  descriptionOverride: string | null;
  shareUrl: string | null;
  updatedAt: string;
}

export interface PortfolioAssetConfig {
  immichAssetId: string;
  albumId: string;
  visibility: PortfolioAssetVisibility;
  featured: boolean;
  sortOrder: number;
  allowDownload: boolean;
  titleOverride: string | null;
  descriptionOverride: string | null;
  updatedAt: string;
}

export interface AssetAnnotation {
  immichAssetId: string;
  primaryGenre: PortfolioGenre | null;
  secondaryGenre: PortfolioGenre | null;
  portfolioRole: PortfolioRole;
  aiScore: number | null;
  semanticScore: number | null;
  aestheticScore: number | null;
  technicalScore: number | null;
  uniquenessScore: number | null;
  genreConfidence: number | null;
  duplicateClusterId: string | null;
  aiSummary: string | null;
  aiTags: string[];
  aiProvider: string | null;
  aiModel: string | null;
  aiProcessedAt: string | null;
  exportCandidate: boolean;
  reviewState: ReviewState;
  manifestPath: string | null;
  updatedAt: string;
}

export interface Person {
  id: string;
  displayName: string;
  slug: string;
  visibility: PersonVisibility;
  sourcePriority: number;
  confidenceScore: number | null;
  updatedAt: string;
}

export interface PersonSource {
  id: number;
  personId: string;
  sourceType: PersonSourceType;
  sourcePersonKey: string;
  sourceLabel: string | null;
  confidenceScore: number | null;
  rawPayload: string | null;
  updatedAt: string;
}

export interface FaceBox {
  height: number;
  left: number;
  top: number;
  width: number;
}

export interface AssetPerson {
  personId: string;
  immichAssetId: string;
  sourceType: PersonSourceType;
  sourceFaceKey: string;
  confidenceScore: number | null;
  reviewState: ReviewState;
  faceBox: FaceBox | null;
  updatedAt: string;
}

export interface ImmichExifInfo {
  description?: string | null;
  dateTimeOriginal?: string | null;
  fileSizeInByte?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  make?: string | null;
  model?: string | null;
  lensModel?: string | null;
  fNumber?: number | null;
  focalLength?: number | null;
  iso?: number | null;
  exposureTime?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
}

export interface ImmichAssetFace {
  faceAssetId: string | null;
  faceBox: FaceBox | null;
  personId: string;
  personName: string | null;
  visibility: PersonVisibility | null;
}

export interface ImmichAsset {
  id: string;
  type: string;
  originalFileName: string;
  originalMimeType?: string | null;
  fileCreatedAt?: string | null;
  fileModifiedAt?: string | null;
  localDateTime?: string | null;
  updatedAt?: string | null;
  thumbhash?: string | null;
  exifInfo?: ImmichExifInfo | null;
  people?: ImmichAssetFace[];
}

export interface ImmichAlbum {
  id: string;
  albumName: string;
  description?: string | null;
  albumThumbnailAssetId?: string | null;
  assetCount?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  assets?: ImmichAsset[];
}

export interface ImmichPerson {
  id: string;
  name: string | null;
  isHidden: boolean;
  faceCount: number | null;
  thumbnailAssetId: string | null;
}

export interface ImmichPersonAsset {
  assetId: string;
  confidenceScore: number | null;
  faceBox: FaceBox | null;
  sourceFaceKey: string | null;
}

export interface PublicAssetPerson {
  confidenceScore: number | null;
  displayName: string;
  faceBox: FaceBox | null;
  href: string;
  id: string;
  slug: string;
}

export interface PublicAsset {
  id: string;
  originalFileName: string;
  title: string;
  description: string | null;
  captureAt: string | null;
  cameraLabel: string | null;
  lensLabel: string | null;
  locationLabel: string | null;
  exifInfo: ImmichExifInfo | null;
  publicAlbumSlugs: string[];
  featured: boolean;
  allowDownload: boolean;
  thumbUrl: string;
  previewUrl: string;
  downloadUrl: string | null;
  primaryGenre: PortfolioGenre | null;
  secondaryGenre: PortfolioGenre | null;
  portfolioRole: PortfolioRole;
  reviewState: ReviewState;
  aiScore: number | null;
  people: PublicAssetPerson[];
}

export interface PublicAlbum {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverAssetId: string | null;
  assetCount: number;
  featured: boolean;
  sortOrder: number;
  shareUrl: string | null;
  assets?: PublicAsset[];
}

export interface PublicPersonSummary {
  assetCount: number;
  confidenceScore: number | null;
  coverAssetId: string | null;
  displayName: string;
  href: string;
  id: string;
  slug: string;
}

export interface PublicPersonDetail {
  assets: PublicAsset[];
  person: PublicPersonSummary;
}

export interface PublicSearchResult {
  assetId: string;
  score: number | null;
  matchedBy: string;
  publicAlbumSlugs: string[];
  asset: PublicAsset;
}

export interface HomeSpecialtySection {
  assets: PublicAsset[];
  description: string;
  genre: PortfolioGenre;
  href: string;
  title: string;
}

export interface HomePageData {
  featuredAlbums: PublicAlbum[];
  featuredPeople: PublicPersonSummary[];
  signatureAssets: PublicAsset[];
  specialtySections: HomeSpecialtySection[];
}

export interface HistogramBins {
  blue: number[];
  green: number[];
  luma: number[];
  red: number[];
}

export interface MediaAnalysisResponse {
  analysisSize: {
    height: number;
    width: number;
  };
  binCount: number;
  bins: HistogramBins;
  sourceSize: {
    height: number;
    width: number;
  };
}

export interface AdminAssetPerson {
  confidenceScore: number | null;
  displayName: string;
  id: string;
  slug: string;
  sourceTypes: PersonSourceType[];
  visibility: PersonVisibility;
}

export interface AdminAlbumSummary extends PublicAlbum {
  visibility: PortfolioVisibility;
  immichTitle: string;
  immichDescription: string | null;
}

export interface AdminAssetSummary extends PublicAsset {
  albumId: string;
  visibility: PortfolioAssetVisibility;
  sortOrder: number;
  titleOverride: string | null;
  descriptionOverride: string | null;
  aiSummary: string | null;
  aiTags: string[];
  aiProvider: string | null;
  aiModel: string | null;
  aiProcessedAt: string | null;
  exportCandidate: boolean;
  semanticScore: number | null;
  aestheticScore: number | null;
  technicalScore: number | null;
  uniquenessScore: number | null;
  genreConfidence: number | null;
  duplicateClusterId: string | null;
  linkedPeople: AdminAssetPerson[];
}

export interface AdminPersonSummary extends Person {
  assetCount: number;
  coverAssetId: string | null;
  publicAssetCount: number;
  sourceCount: number;
  sourceTypes: PersonSourceType[];
}

export interface AdminDashboardData {
  status: {
    hasImmichConfig: boolean;
    connected: boolean;
    message: string;
  };
  albums: AdminAlbumSummary[];
  people: AdminPersonSummary[];
  selectedAlbumId: string | null;
  selectedAlbumAssets: AdminAssetSummary[];
}

export interface LightroomFaceManifestRow {
  absoluteCatalogPath: string;
  captureAt: string | null;
  faceHeight: number;
  faceLeft: number;
  faceTop: number;
  faceWidth: number;
  filename: string;
  keywordId: string;
  personName: string;
  relativeCatalogPath: string;
  sourceConfidence: number;
  sourceFaceKey: string;
}

export interface ImmichPeopleSyncRecord {
  assetIds: string[];
  confidenceScore: number | null;
  isHidden: boolean;
  name: string | null;
  personId: string;
  sourceUpdatedAt: string | null;
}
