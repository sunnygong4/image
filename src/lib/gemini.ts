import type { PortfolioGenre, PortfolioRole } from "@/lib/types";

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

export interface GeminiAnnotation {
  aiSummary: string;
  aiTags: string[];
  genreConfidence: number;
  exportCandidate: boolean;
  portfolioRole: PortfolioRole;
  primaryGenre: PortfolioGenre;
  secondaryGenre: PortfolioGenre | null;
  semanticScore: number;
}

export async function analyzeImageWithGemini(
  imageBytes: ArrayBuffer,
  mimeType: string,
  apiKey: string,
  model: string,
): Promise<GeminiAnnotation> {
  const base64 = Buffer.from(imageBytes).toString("base64");

  const prompt = [
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
  ].join("\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { data: base64, mimeType } },
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
    const errText = await response.text().catch(() => "");
    throw new Error(`Gemini request failed (${response.status}): ${errText}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text =
    payload.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim() ?? "";

  if (!text) throw new Error("Gemini returned an empty response.");

  const raw = JSON.parse(stripCodeFence(text)) as Record<string, unknown>;
  return normalizeAnnotation(raw);
}

function stripCodeFence(value: string) {
  return value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");
}

function normalizeAnnotation(raw: Record<string, unknown>): GeminiAnnotation {
  const primary = normalizeGenre(raw.primary_genre_guess) ?? "other";
  const secondary =
    normalizeGenre(raw.secondary_genre_guess) !== primary
      ? normalizeGenre(raw.secondary_genre_guess)
      : null;

  return {
    aiSummary: normalizeSummary(raw.ai_summary),
    aiTags: normalizeTags(raw.ai_tags),
    genreConfidence: clamp(raw.confidence),
    exportCandidate: Boolean(raw.export_candidate),
    portfolioRole: normalizeRole(raw.portfolio_role_guess),
    primaryGenre: primary,
    secondaryGenre: secondary,
    semanticScore: clamp(raw.semantic_score),
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

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        .map((v) => v.trim().toLowerCase())
        .slice(0, 8),
    ),
  ];
}

function normalizeSummary(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length > 180 ? `${trimmed.slice(0, 177).trimEnd()}...` : trimmed;
}

function clamp(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}
