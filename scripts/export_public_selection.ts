import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

import { listAssetAnnotations, listAssetAssociations } from "@/lib/db";
import { getAiPipelineEnv } from "@/lib/env";
import { getVisibleAssociations, type AssetAssociation } from "@/lib/visibility";
import { loadLocalEnv } from "./load-local-env";

loadLocalEnv();

interface ExportRecord {
  assetId: string;
  destinationPath: string;
  primaryGenre: string;
  sourcePath: string;
}

async function main() {
  const env = getAiPipelineEnv();
  const args = parseArgs(process.argv.slice(2));
  const sourceRootInput = args.sourceRoot ?? env.sourceRoot;
  const exportRootInput = args.exportRoot ?? env.exportRoot;

  if (!sourceRootInput) {
    throw new Error("AI_SOURCE_ROOT is required.");
  }

  if (!exportRootInput) {
    throw new Error("AI_EXPORT_ROOT is required.");
  }

  const sourceRoot = resolve(process.cwd(), sourceRootInput);
  const exportRoot = resolve(process.cwd(), exportRootInput);

  if (!sourceRoot || !existsSync(sourceRoot)) {
    throw new Error("AI_SOURCE_ROOT must point to an existing folder.");
  }

  mkdirSync(exportRoot, { recursive: true });

  const associationsByAsset = new Map<string, AssetAssociation[]>();
  for (const association of listAssetAssociations()) {
    const current = associationsByAsset.get(association.immichAssetId) ?? [];
    current.push(association);
    associationsByAsset.set(association.immichAssetId, current);
  }

  const records: ExportRecord[] = [];

  for (const annotation of listAssetAnnotations()) {
    const associations = getVisibleAssociations(
      associationsByAsset.get(annotation.immichAssetId) ?? [],
    );
    if (!associations.length || annotation.reviewState !== "approved" || !annotation.manifestPath) {
      continue;
    }

    const sourcePath = resolve(sourceRoot, annotation.manifestPath);
    if (!existsSync(sourcePath)) {
      continue;
    }

    const primaryGenre = annotation.primaryGenre ?? "other";
    const destinationPath = resolve(exportRoot, primaryGenre, annotation.manifestPath);
    mkdirSync(dirname(destinationPath), { recursive: true });
    copyFileSync(sourcePath, destinationPath);

    records.push({
      assetId: annotation.immichAssetId,
      destinationPath,
      primaryGenre,
      sourcePath,
    });
  }

  const manifestPath = resolve(exportRoot, "_export-manifest.json");
  const previous = readJsonArray<ExportRecord>(manifestPath);
  writeFileSync(manifestPath, JSON.stringify(records, null, 2), "utf8");

  if (args.prune) {
    const currentPaths = new Set(records.map((record) => record.destinationPath));
    for (const record of previous) {
      if (currentPaths.has(record.destinationPath) || !existsSync(record.destinationPath)) {
        continue;
      }

      unlinkSync(record.destinationPath);
      pruneEmptyDirectories(dirname(record.destinationPath), exportRoot);
    }
  }

  console.log(
    JSON.stringify(
      {
        exportRoot,
        exportedCount: records.length,
        pruned: args.prune,
        sourceRoot,
      },
      null,
      2,
    ),
  );
}

function parseArgs(argv: string[]) {
  const args: {
    exportRoot?: string;
    prune: boolean;
    sourceRoot?: string;
  } = {
    prune: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value) {
      continue;
    }

    if (value === "--prune") {
      args.prune = true;
      continue;
    }

    const next = argv[index + 1];
    if (!next) {
      continue;
    }

    if (value === "--source-root") {
      args.sourceRoot = next;
      index += 1;
    } else if (value === "--export-root") {
      args.exportRoot = next;
      index += 1;
    }
  }

  return args;
}

function readJsonArray<T>(path: string) {
  if (!existsSync(path)) {
    return [] as T[];
  }

  try {
    return JSON.parse(readFileSync(path, "utf8")) as T[];
  } catch {
    return [] as T[];
  }
}

function pruneEmptyDirectories(startPath: string, stopPath: string) {
  let current = startPath;

  while (current.startsWith(stopPath) && current !== stopPath) {
    try {
      rmSync(current, { recursive: false });
    } catch {
      break;
    }

    current = dirname(current);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
