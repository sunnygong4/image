import * as assert from "node:assert/strict";

import {
  getVisibleAssociations,
  isAssetVisible,
  pickPrimaryAssociation,
  type AssetAssociation,
} from "../src/lib/visibility";

function buildAssociation(
  overrides: Partial<AssetAssociation> = {},
): AssetAssociation {
  return {
    immichAssetId: "asset-1",
    albumId: "album-1",
    albumSlug: "album-1",
    albumVisibility: "public",
    assetVisibility: "inherit",
    allowDownload: false,
    featured: false,
    sortOrder: 0,
    titleOverride: null,
    descriptionOverride: null,
    shareUrl: null,
    ...overrides,
  };
}

export function runVisibilityTests() {
  assert.equal(
    isAssetVisible(
      buildAssociation({
        albumVisibility: "public",
        assetVisibility: "inherit",
      }),
    ),
    true,
  );

  assert.equal(
    isAssetVisible(
      buildAssociation({
        albumVisibility: "private",
        assetVisibility: "inherit",
      }),
    ),
    false,
  );
 
  assert.equal(
    isAssetVisible(
      buildAssociation({
        albumVisibility: "private",
        assetVisibility: "public",
      }),
    ),
    true,
  );

  assert.equal(
    isAssetVisible(
      buildAssociation({
        albumVisibility: "public",
        assetVisibility: "private",
      }),
    ),
    false,
  );

  const primary = pickPrimaryAssociation([
    buildAssociation({
      albumId: "album-a",
      albumSlug: "a",
      albumVisibility: "public",
      assetVisibility: "inherit",
      featured: false,
      sortOrder: 10,
    }),
    buildAssociation({
      albumId: "album-b",
      albumSlug: "b",
      albumVisibility: "private",
      assetVisibility: "public",
      featured: true,
      sortOrder: 1,
    }),
  ]);

  assert.ok(primary);
  assert.equal(primary.albumId, "album-b");

  const visible = getVisibleAssociations([
    buildAssociation({
      albumId: "album-a",
      albumSlug: "a",
      albumVisibility: "public",
      assetVisibility: "private",
    }),
    buildAssociation({
      albumId: "album-b",
      albumSlug: "b",
      albumVisibility: "private",
      assetVisibility: "public",
    }),
  ]);

  assert.equal(visible.length, 1);
  assert.equal(visible[0]?.albumId, "album-b");
}
