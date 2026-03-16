import { mkdirSync, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import sharp from "sharp";

import { getAiPipelineEnv } from "@/lib/env";
import type { PortfolioGenre, PortfolioRole } from "@/lib/types";
import { loadLocalEnv } from "./load-local-env";

loadLocalEnv();

const DEFAULT_ROOT = "C:\\Users\\sunny\\Pictures\\LRC Saved";
const DEFAULT_INPUT = "ops/catalog-ranking/manifest.json";
const DEFAULT_OUTPUT = "ops/ai-ranking/gemini-manifest.json";
const DEFAULT_CONCURRENCY = 2;
const GENRES: PortfolioGenre[] = [
  "landscape",
  "street",
  "wildlife",
  "event",
  "product",
  "sports",
  "film",
  "other",
];
const ROLES: PortfolioRole[] = ["signature", "specialty", "archive", "hidden"];

interface RankingRow {
  relative_path: string;
  filename: string;
  capture_at?: string | null;
  primary_genre_guess?: string | null;
  secondary_genre_guess?: string | null;
  genre_confidence?: number | null;
  duplicate_cluster_id?: string | null;
  aesthetic_score?: number | null;
  technical_score?: number | null;
  uniqueness_score?: number | null;
  ai_score?: number | null;
  portfolio_role_guess?: string | null;
  shortlist_flag?: boolean;
  signature_flag?: boolean;
  ai_summary?: string | null;
  ai_tags?: string[] | null;
  ai_provider?: string | null;
  ai_model?: string | null;
  ai_processed_at?: string | null;
  semantic_score?: number | null;
  export_candidate?: boolean | null;
  ai_error?: string | null;
  source_fingerprint?: string | null;
}

interface GeminiAnnotation {
  ai_summary: string;
  ai_tags: string[];
  confidence: number;
  export_candidate: boolean;
  portfolio_role_guess: PortfolioRole;
  primary_genre_guess: PortfolioGenre;
  secondary_genre_guess: PortfolioGenre | null;
  semantic_score: number;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = getAiPipelineEnv();
  const apiKey = env.geminiApiKey;
  const model = env.geminiModel;
  const rootInput = args.root ?? env.sourceRoot ?? DEFAULT_ROOT;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required.");
  }

  const inputPath = resolve(process.cwd(), args.inputPath ?? DEFAULT_INPUT);
  const outputPath = resolve(process.cwd(), args.outputPath ?? DEFAULT_OUTPUT);
  const root = resolve(process.cwd(), rootInput);
  const inputRows = JSON.parse(readFileSync(inputPath, "utf8")) as RankingRow[];
  const previousRows = readJsonArray<RankingRow>(outputPath);
  const previousByPath = new Map(
    previousRows.map((row) => [row.relative_path.toLowerCase(), row]),
  );

  const selectedRows = (args.limit > 0 ? inputRows.slice(0, args.limit) : inputRows).map(
    (row) => ({ ...row }),
  );
  const outputRows = new Array<RankingRow>(selectedRows.length);
  const workItems: Array<{ index: number; row: RankingRow; absolutePath: string; fingerprint: string }> = [];
  let reusedCount = 0;

  for (const [index, row] of selectedRows.entries()) {
    const absolutePath = resolve(root, row.relative_path);
    if (!existsSync(absolutePath)) {
      outputRows[index] = {
        ...row,
        ai_error: "Source file not found.",
      };
      continue;
    }

    const stats = statSync(absolutePath);
    const fingerprint = `${stats.size}:${stats.mtimeMs}`;
    const cached = previousByPath.get(row.relative_path.toLowerCase());
    if (!args.force && cached?.source_fingerprint === fingerprint && cached.ai_processed_at) {
      outputRows[index] = {
        ...row,
        ...pickAiFields(cached),
        source_fingerprint: fingerprint,
      };
      reusedCount += 1;
      continue;
    }

    workItems.push({ index, row, absolutePath, fingerprint });
  }

  let completed = 0;

  await runWithConcurrency(workItems, args.concurrency, async (item) => {
    try {
      const annotation = await annotateImage({
        absolutePath: item.absolutePath,
        apiKey,
        model,
        row: item.row,
      });
      outputRows[item.index] = mergeAnnotation(item.row, annotation, model, item.fingerprint);
    } catch (error) {
      outputRows[item.index] = {
        ...item.row,
        ai_error: error instanceof Error ? error.message : "Gemini annotation failed.",
        source_fingerprint: item.fingerprint,
      };
    }

    completed += 1;
    if (completed % 10 === 0 || completed === workItems.length) {
      console.log(`Annotated ${completed}/${workItems.length}`);
    }
  });

  for (const [index, row] of outputRows.entries()) {
    if (!row) {
      outputRows[index] = {
        ...selectedRows[index]!,
        ai_error: "Annotation was skipped unexpectedly.",
      };
    }
  }

  recomputeScoresAndRoles(outputRows);
  writeOutputs(outputRows, outputPath);

  console.log(
    JSON.stringify(
      {
        inputPath,
        outputPath,
        reusedCount,
        processedCount: workItems.length,
        totalRows: outputRows.length,
      },
      null,
      2,
    ),
  );
}

function parseArgs(argv: string[]) {
  const args: {
    concurrency: number;
    force: boolean;
    inputPath?: string;
    limit: number;
    outputPath?: string;
    root?: string;
  } = {
    concurrency: DEFAULT_CONCURRENCY,
    force: false,
    limit: 0,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value) {
      continue;
    }

    if (value === "--force") {
      args.force = true;
      continue;
    }

    const next = argv[index + 1];
    if (!next) {
      continue;
    }

    if (value === "--input") {
      args.inputPath = next;
      index += 1;
    } else if (value === "--output") {
      args.outputPath = next;
      index += 1;
    } else if (value === "--root") {
      args.root = next;
      index += 1;
    } else if (value === "--limit") {
      args.limit = Number(next) || 0;
      index += 1;
    } else if (value === "--concurrency") {
      args.concurrency = Math.max(1, Number(next) || DEFAULT_CONCURRENCY);
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

function pickAiFields(row: RankingRow): Partial<RankingRow> {
  return {
    ai_error: row.ai_error ?? null,
    ai_model: row.ai_model ?? null,
    ai_processed_at: row.ai_processed_at ?? null,
    ai_provider: row.ai_provider ?? null,
    ai_summary: row.ai_summary ?? null,
    ai_tags: row.ai_tags ?? [],
    export_candidate: row.export_candidate ?? false,
    portfolio_role_guess: row.portfolio_role_guess ?? "archive",
    primary_genre_guess: row.primary_genre_guess ?? "other",
    secondary_genre_guess: row.secondary_genre_guess ?? null,
    semantic_score: row.semantic_score ?? null,
    source_fingerprint: row.source_fingerprint ?? null,
  };
}

async function annotateImage({
  absolutePath,
  apiKey,
  model,
  row,
}: {
  absolutePath: string;
  apiKey: string;
  model: string;
  row: RankingRow;
}) {
  const imageBuffer = await sharp(absolutePath)
    .rotate()
    .resize({
      fit: "inside",
      height: 1600,
      width: 1600,
      withoutEnlargement: true,
    })
    .jpeg({ mozjpeg: true, quality: 82 })
    .toBuffer();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: buildPrompt(row),
              },
              {
                inlineData: {
                  data: imageBuffer.toString("base64"),
                  mimeType: "image/jpeg",
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };
  const text =
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? "";

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return normalizeAnnotation(JSON.parse(stripCodeFence(text)) as Record<string, unknown>);
}

function buildPrompt(row: RankingRow) {
  const hint = row.primary_genre_guess ? `Current heuristic genre: ${row.primary_genre_guess}.` : "";

  return [
    "You are rating a photo for a personal photography portfolio.",
    "Use these public portfolio genres only: landscape, street, wildlife, event, product, sports, film, other.",
    "You may still use richer private tags such as everyday, portrait, candid, architecture, travel, documentary, nature, etc.",
    "Map daily-life and everyday scenes to street or other unless another public genre fits more strongly.",
    "Return a JSON object with these exact keys:",
    "primary_genre_guess, secondary_genre_guess, ai_tags, ai_summary, semantic_score, portfolio_role_guess, export_candidate, confidence.",
    "Rules:",
    "- ai_tags: 3 to 8 short lowercase tags",
    "- ai_summary: one factual sentence under 180 characters",
    "- semantic_score: number from 0 to 1",
    "- portfolio_role_guess: signature, specialty, archive, or hidden",
    "- export_candidate: true only if the photo feels portfolio-usable after human review",
    "- confidence: number from 0 to 1",
    hint,
  ]
    .filter(Boolean)
    .join("\n");
}

function stripCodeFence(value: string) {
  return value.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");
}

function normalizeAnnotation(payload: Record<string, unknown>): GeminiAnnotation {
  const primary = normalizeGenre(payload.primary_genre_guess) ?? "other";
  const secondary =
    normalizeGenre(payload.secondary_genre_guess) &&
    normalizeGenre(payload.secondary_genre_guess) !== primary
      ? normalizeGenre(payload.secondary_genre_guess)
      : null;

  return {
    ai_summary: normalizeSummary(payload.ai_summary),
    ai_tags: normalizeTags(payload.ai_tags),
    confidence: clampNumber(payload.confidence),
    export_candidate: Boolean(payload.export_candidate),
    portfolio_role_guess: normalizeRole(payload.portfolio_role_guess),
    primary_genre_guess: primary,
    secondary_genre_guess: secondary,
    semantic_score: clampNumber(payload.semantic_score),
  };
}

function normalizeGenre(value: unknown): PortfolioGenre | null {
  return typeof value === "string" && GENRES.includes(value as PortfolioGenre)
    ? (value as PortfolioGenre)
    : null;
}

function normalizeRole(value: unknown): PortfolioRole {
  return typeof value === "string" && ROLES.includes(value as PortfolioRole)
    ? (value as PortfolioRole)
    : "archive";
}

function normalizeTags(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return [...new Set(
    value
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim().toLowerCase())
      .slice(0, 8),
  )];
}

function normalizeSummary(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length > 180 ? `${trimmed.slice(0, 177).trimEnd()}...` : trimmed;
}

function clampNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 1);
}

function mergeAnnotation(
  row: RankingRow,
  annotation: GeminiAnnotation,
  model: string,
  fingerprint: string,
): RankingRow {
  const now = new Date().toISOString();

  return {
    ...row,
    ai_error: null,
    ai_model: model,
    ai_processed_at: now,
    ai_provider: "gemini",
    ai_summary: annotation.ai_summary,
    ai_tags: annotation.ai_tags,
    export_candidate: annotation.export_candidate,
    genre_confidence: annotation.confidence,
    portfolio_role_guess: annotation.portfolio_role_guess,
    primary_genre_guess: annotation.primary_genre_guess,
    secondary_genre_guess: annotation.secondary_genre_guess,
    semantic_score: annotation.semantic_score,
    source_fingerprint: fingerprint,
  };
}

function recomputeScoresAndRoles(rows: RankingRow[]) {
  for (const row of rows) {
    row.ai_score = round4(computeAiScore(row));
    row.genre_confidence = round4(clampNumber(row.genre_confidence));
    row.semantic_score = round4(clampNumber(row.semantic_score));
  }

  const byGenre = new Map<string, RankingRow[]>();
  for (const row of rows) {
    const genre = row.primary_genre_guess ?? "other";
    const current = byGenre.get(genre) ?? [];
    current.push(row);
    byGenre.set(genre, current);
  }

  for (const items of byGenre.values()) {
    items.sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0));
  }

  const signature = new Set(
    ["landscape", "wildlife"].flatMap((genre) =>
      (byGenre.get(genre) ?? []).slice(0, 100).map((row) => row.relative_path),
    ),
  );
  const specialty = new Set(
    ["event", "product", "sports"].flatMap((genre) =>
      (byGenre.get(genre) ?? []).slice(0, 60).map((row) => row.relative_path),
    ),
  );

  for (const row of rows) {
    if (signature.has(row.relative_path)) {
      row.portfolio_role_guess = "signature";
      row.signature_flag = true;
      row.shortlist_flag = true;
    } else if (specialty.has(row.relative_path)) {
      row.portfolio_role_guess = "specialty";
      row.signature_flag = false;
      row.shortlist_flag = true;
    } else {
      row.portfolio_role_guess = row.portfolio_role_guess === "hidden" ? "hidden" : "archive";
      row.signature_flag = false;
      row.shortlist_flag = false;
    }
  }

  rows.sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0));
}

function computeAiScore(row: RankingRow) {
  const aesthetic = clampNumber(row.aesthetic_score);
  const technical = clampNumber(row.technical_score);
  const uniqueness = clampNumber(row.uniqueness_score);
  const semantic = clampNumber(row.semantic_score);
  const confidence = clampNumber(row.genre_confidence);
  const primaryGenre = row.primary_genre_guess ?? "other";

  const genreBoost =
    primaryGenre === "landscape" || primaryGenre === "wildlife"
      ? 0.08
      : primaryGenre === "event" || primaryGenre === "product" || primaryGenre === "sports"
        ? 0.05
        : 0;

  return Math.min(
    1,
    0.3 * aesthetic +
      0.22 * technical +
      0.18 * uniqueness +
      0.2 * semantic +
      0.1 * confidence +
      genreBoost,
  );
}

function round4(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
) {
  let cursor = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length || 1) }, () =>
      runWorker(),
    ),
  );
}

function writeOutputs(rows: RankingRow[], outputPath: string) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(rows, null, 2), "utf8");
  writeFileSync(outputPath.replace(/\.json$/i, ".csv"), toCsv(rows), "utf8");
}

function toCsv(rows: RankingRow[]) {
  if (!rows.length) {
    return "";
  }

  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [headers.join(",")];

  for (const row of rows) {
    lines.push(
      headers
        .map(
          (header) =>
            JSON.stringify((row as unknown as Record<string, unknown>)[header] ?? ""),
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
