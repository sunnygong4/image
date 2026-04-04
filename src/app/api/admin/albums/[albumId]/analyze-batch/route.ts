import { ensureAssetAnnotations, listAssetAssociationsForAlbum, updateAssetAnnotation } from "@/lib/db";
import { getAiPipelineEnv } from "@/lib/env";
import { analyzeImageWithGemini } from "@/lib/gemini";
import { fetchImmichThumbnail } from "@/lib/immich";

export const runtime = "nodejs";
// Allow long-running streaming responses
export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  const { albumId } = await params;

  const env = getAiPipelineEnv();
  if (!env.hasGeminiConfig) {
    return Response.json({ error: "GEMINI_API_KEY is not configured." }, { status: 503 });
  }

  const assetIds = [
    ...new Set(listAssetAssociationsForAlbum(albumId).map((a) => a.immichAssetId)),
  ];

  if (!assetIds.length) {
    return Response.json({ error: "No assets found for this album." }, { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      send({ total: assetIds.length, status: "starting" });

      let completed = 0;
      let errors = 0;

      for (const assetId of assetIds) {
        try {
          const imageResponse = await fetchImmichThumbnail(assetId, "preview");
          if (!imageResponse.ok) throw new Error(`Immich returned ${imageResponse.status}`);

          const imageBytes = await imageResponse.arrayBuffer();
          const mimeType =
            (imageResponse.headers.get("content-type") ?? "image/jpeg")
              .split(";")[0]
              ?.trim() ?? "image/jpeg";

          const annotation = await analyzeImageWithGemini(
            imageBytes,
            mimeType,
            env.geminiApiKey,
            env.geminiModel,
          );

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

          completed++;
          send({ completed, total: assetIds.length, errors, assetId, ok: true });
        } catch (err) {
          errors++;
          completed++;
          send({
            completed,
            total: assetIds.length,
            errors,
            assetId,
            error: err instanceof Error ? err.message : "Analysis failed",
          });
        }

        // Throttle to stay within Gemini free-tier rate limits
        await new Promise((r) => setTimeout(r, 600));
      }

      send({ done: true, completed: assetIds.length, errors, total: assetIds.length });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
