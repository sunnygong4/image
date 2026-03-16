import {
  createPerson,
  getPersonBySource,
  listAssetPeople,
  listPeople,
  updatePerson,
  upsertAssetPerson,
  upsertPersonSource,
} from "@/lib/db";
import { listImmichAssetsForPerson, listImmichPeople } from "@/lib/immich";
import { slugify } from "@/lib/slug";
import type { ImmichPersonAsset, Person, PersonVisibility } from "@/lib/types";

const IMMICH_SOURCE_PRIORITY = 50;
const EXACT_NAME_CONFIDENCE = 0.96;
const OVERLAP_CONFIDENCE = 0.9;
const AUTO_PUBLIC_MIN_ASSETS = 4;
const OVERLAP_MIN_ASSETS = 3;
const OVERLAP_MIN_RATIO = 0.6;

export async function syncPeopleFromImmich() {
  const existingPeople = listPeople();
  const assetLinks = listAssetPeople().filter((link) => link.reviewState !== "rejected");
  const assetIdsByPerson = new Map<string, Set<string>>();

  for (const link of assetLinks) {
    const current = assetIdsByPerson.get(link.personId) ?? new Set<string>();
    current.add(link.immichAssetId);
    assetIdsByPerson.set(link.personId, current);
  }

  const peopleByNormalizedName = new Map(
    existingPeople
      .map((person) => [normalizeName(person.displayName), person] as const)
      .filter(([key]) => key),
  );

  let mergedCount = 0;
  let createdCount = 0;
  let membershipCount = 0;

  for (const immichPerson of await listImmichPeople()) {
    const memberships = await listImmichAssetsForPerson(immichPerson.id);
    const normalizedName = normalizeName(immichPerson.name);
    const exactMatch = normalizedName
      ? peopleByNormalizedName.get(normalizedName) ?? null
      : null;
    const mappedPerson = getPersonBySource("immich", immichPerson.id);
    const overlapMatch = !mappedPerson
      ? findOverlapMatch(existingPeople, assetIdsByPerson, memberships)
      : null;
    const resolvedPerson =
      mappedPerson ??
      exactMatch ??
      overlapMatch ??
      createPerson({
        confidenceScore: normalizedName ? EXACT_NAME_CONFIDENCE : 0.35,
        displayName:
          immichPerson.name?.trim() || `Immich Person ${immichPerson.id.slice(0, 8)}`,
        slug:
          immichPerson.name?.trim()
            ? slugify(immichPerson.name)
            : `immich-person-${immichPerson.id.slice(0, 8)}`,
        sourcePriority: IMMICH_SOURCE_PRIORITY,
        visibility: getVisibilityForImmichPerson(
          immichPerson.isHidden,
          Boolean(normalizedName),
          memberships.length,
          exactMatch ?? overlapMatch,
        ),
      });

    if (!mappedPerson) {
      if (exactMatch || overlapMatch) {
        mergedCount += 1;
      } else {
        createdCount += 1;
      }
    }

    const desiredVisibility = getVisibilityForImmichPerson(
      immichPerson.isHidden,
      Boolean(normalizedName),
      memberships.length,
      exactMatch ?? overlapMatch ?? null,
    );

    updatePerson(resolvedPerson.id, {
      confidenceScore: Math.max(
        resolvedPerson.confidenceScore ?? 0,
        exactMatch
          ? EXACT_NAME_CONFIDENCE
          : overlapMatch
            ? OVERLAP_CONFIDENCE
            : normalizedName
              ? 0.82
              : 0.35,
      ),
      displayName:
        normalizedName && resolvedPerson.displayName.startsWith("Immich Person")
          ? immichPerson.name?.trim()
          : resolvedPerson.displayName,
      sourcePriority: Math.max(resolvedPerson.sourcePriority, IMMICH_SOURCE_PRIORITY),
      visibility: desiredVisibility,
    });

    upsertPersonSource({
      confidenceScore: normalizedName
        ? exactMatch
          ? EXACT_NAME_CONFIDENCE
          : overlapMatch
            ? OVERLAP_CONFIDENCE
            : 0.82
        : 0.35,
      personId: resolvedPerson.id,
      rawPayload: JSON.stringify(immichPerson),
      sourceLabel: immichPerson.name,
      sourcePersonKey: immichPerson.id,
      sourceType: "immich",
    });

    for (const membership of memberships) {
      upsertAssetPerson({
        confidenceScore: membership.confidenceScore ?? null,
        faceBox: membership.faceBox,
        immichAssetId: membership.assetId,
        personId: resolvedPerson.id,
        reviewState: desiredVisibility === "public" ? "approved" : "suggested",
        sourceFaceKey:
          membership.sourceFaceKey ?? `${immichPerson.id}:${membership.assetId}`,
        sourceType: "immich",
      });
      membershipCount += 1;
    }
  }

  return {
    createdCount,
    membershipCount,
    mergedCount,
    syncedAt: new Date().toISOString(),
  };
}

function findOverlapMatch(
  people: Person[],
  assetIdsByPerson: Map<string, Set<string>>,
  memberships: ImmichPersonAsset[],
) {
  const membershipIds = new Set(memberships.map((membership) => membership.assetId));
  let bestMatch: { overlap: number; person: Person; ratio: number } | null = null;

  for (const person of people) {
    const existingAssetIds = assetIdsByPerson.get(person.id);
    if (!existingAssetIds?.size) {
      continue;
    }

    let overlap = 0;
    for (const assetId of existingAssetIds) {
      if (membershipIds.has(assetId)) {
        overlap += 1;
      }
    }

    const ratio = overlap / Math.max(existingAssetIds.size, membershipIds.size, 1);
    if (
      overlap >= OVERLAP_MIN_ASSETS &&
      ratio >= OVERLAP_MIN_RATIO &&
      (!bestMatch ||
        overlap > bestMatch.overlap ||
        (overlap === bestMatch.overlap && ratio > bestMatch.ratio))
    ) {
      bestMatch = { overlap, person, ratio };
    }
  }

  return bestMatch?.person ?? null;
}

function getVisibilityForImmichPerson(
  isHidden: boolean,
  hasName: boolean,
  assetCount: number,
  matchedPerson: Person | null,
): PersonVisibility {
  if (isHidden) {
    return "hidden";
  }

  if (matchedPerson) {
    return matchedPerson.visibility === "hidden" ? "hidden" : "public";
  }

  if (hasName && assetCount >= AUTO_PUBLIC_MIN_ASSETS) {
    return "public";
  }

  return hasName ? "private" : "hidden";
}

function normalizeName(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
