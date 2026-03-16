import type {
  PortfolioAssetVisibility,
  PortfolioVisibility,
} from "./types";

export interface AssetAssociation {
  immichAssetId: string;
  albumId: string;
  albumSlug: string;
  albumVisibility: PortfolioVisibility;
  assetVisibility: PortfolioAssetVisibility;
  allowDownload: boolean;
  featured: boolean;
  sortOrder: number;
  titleOverride: string | null;
  descriptionOverride: string | null;
  shareUrl: string | null;
}

export function isAssetVisible(input: {
  albumVisibility: PortfolioVisibility;
  assetVisibility: PortfolioAssetVisibility;
}) {
  if (input.assetVisibility === "private") {
    return false;
  }

  if (input.assetVisibility === "public") {
    return true;
  }

  return input.albumVisibility === "public";
}

export function getVisibleAssociations(associations: AssetAssociation[]) {
  return [...associations]
    .filter((association) => isAssetVisible(association))
    .sort(compareAssociations);
}

export function pickPrimaryAssociation(associations: AssetAssociation[]) {
  return getVisibleAssociations(associations)[0] ?? null;
}

function compareAssociations(a: AssetAssociation, b: AssetAssociation) {
  return (
    visibilityWeight(b.assetVisibility) - visibilityWeight(a.assetVisibility) ||
    Number(b.featured) - Number(a.featured) ||
    a.sortOrder - b.sortOrder ||
    a.albumSlug.localeCompare(b.albumSlug)
  );
}

function visibilityWeight(value: PortfolioAssetVisibility) {
  if (value === "public") {
    return 2;
  }

  if (value === "inherit") {
    return 1;
  }

  return 0;
}
