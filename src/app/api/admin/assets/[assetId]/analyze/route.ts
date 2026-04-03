import { ensureAssetAnnotations, updateAssetAnnotation } from "@/lib/db";
import { getAiPipelineEnv } from "@/lib/env";
import { analyzeImageWithGemini } from "@/lib/gemini";
import { fetchImmichThumbnail } from "@/lib/immich";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await params;

  const env = getAiPipelineEnv();
  if (!env.hasGeminiConfig) {
    return Response.json(
      { error: "GEMINI_API_KEY is not configured." },
      { status: 503 },
    );
  }

  try {
    // Fetch preview image from Immich
    const imageResponse = await fetchImmichThumbnail(assetId, "preview");
    if (!imageResponse.ok) {
      return Response.json(
        { error: `Could not fetch image from Immich (${imageResponse.status}).` },
        { status: 502 },
      );
    }

    const imageBytes = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get("content-type") ?? "image/jpeg";
    const mimeType = contentType.split(";")[0]?.trim() ?? "image/jpeg";

    // Analyze with Gemini
    const annotation = await analyzeImageWithGemini(
      imageBytes,
      mimeType,
      env.geminiApiKey,
      env.geminiModel,
    );

    // Save to DB
    ensureAssetAnnotations([assetId]);
    updateAssetAnnotation(assetId, {
      aiProvider: "gemini",
      aiModel: env.geminiModel,
      aiProcessedAt: new Date().toISOString(),
      aiSummary: annotation.aiSummary || null,
      aiTags: annotation.aiTags,
      genreConfidence: annotation.genreConfidence,
      exportCandidate: annotation.exportCandidate,
      portfolioRole: annotation.portfolioRole,
      primaryGenre: annotation.primaryGenre,
      secondaryGenre: annotation.secondaryGenre,
      semanticScore: annotation.semanticScore,
    });

    return Response.json({ ok: true, annotation });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Gemini analysis failed.",
      },
      { status: 500 },
    );
  }
}
