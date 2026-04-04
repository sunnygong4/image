import { resolve } from "node:path";

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getPortfolioEnv() {
  const immichUrl = stripTrailingSlash(process.env.IMMICH_URL ?? "");
  const immichApiKey = process.env.IMMICH_API_KEY ?? "";
  const siteUrl = stripTrailingSlash(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  );

  return {
    immichUrl,
    immichApiKey,
    siteUrl,
    siteName: process.env.NEXT_PUBLIC_SITE_NAME ?? "Sunny Gong Images",
    portfolioDbPath: resolve(
      process.cwd(),
      process.env.PORTFOLIO_DB_PATH ?? "data/portfolio.sqlite",
    ),
    hasImmichConfig: Boolean(immichUrl && immichApiKey),
  };
}

export function getAiPipelineEnv() {
  const sourceRoot = process.env.AI_SOURCE_ROOT ?? "";
  const exportRoot = process.env.AI_EXPORT_ROOT ?? "";
  const batchStateDir = process.env.AI_BATCH_STATE_DIR ?? "ops/ai-ranking/state";
  const geminiApiKey = process.env.GEMINI_API_KEY ?? "";
  const geminiModel = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

  return {
    batchStateDir: resolve(process.cwd(), batchStateDir),
    exportRoot: exportRoot ? resolve(process.cwd(), exportRoot) : "",
    geminiApiKey,
    geminiModel,
    hasGeminiConfig: Boolean(geminiApiKey),
    sourceRoot: sourceRoot ? resolve(process.cwd(), sourceRoot) : "",
  };
}
