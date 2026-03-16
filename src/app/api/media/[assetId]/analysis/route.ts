import sharp from "sharp";

import { fetchImmichThumbnail } from "@/lib/immich";
import { getPublicAssetById } from "@/lib/portfolio";
import type { MediaAnalysisResponse } from "@/lib/types";

export const runtime = "nodejs";

const BIN_COUNT = 64;
const ANALYSIS_MAX_SIDE = 1024;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await params;
  const asset = await getPublicAssetById(assetId);

  if (!asset) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const immichResponse = await fetchImmichThumbnail(assetId, "fullsize");
    const payload = await buildHistogramPayload(immichResponse);

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Histogram analysis failed for this image.";
    return new Response(message, { status: 500 });
  }
}

async function buildHistogramPayload(
  sourceResponse: Response,
): Promise<MediaAnalysisResponse> {
  const imageBuffer = Buffer.from(await sourceResponse.arrayBuffer());
  const metadata = await sharp(imageBuffer, { failOn: "none" }).metadata();
  const sourceWidth = metadata.width ?? 0;
  const sourceHeight = metadata.height ?? 0;

  if (!sourceWidth || !sourceHeight) {
    throw new Error("Could not read image dimensions.");
  }

  const scale = Math.min(
    1,
    ANALYSIS_MAX_SIDE / Math.max(sourceWidth, sourceHeight),
  );
  const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
  const { data, info } = await sharp(imageBuffer, { failOn: "none" })
    .toColorspace("srgb")
    .removeAlpha()
    .resize(targetWidth, targetHeight, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const lumaBins = Array.from({ length: BIN_COUNT }, () => 0);
  const redBins = Array.from({ length: BIN_COUNT }, () => 0);
  const greenBins = Array.from({ length: BIN_COUNT }, () => 0);
  const blueBins = Array.from({ length: BIN_COUNT }, () => 0);
  const channels = Math.max(1, info.channels);

  for (let index = 0; index < data.length; index += channels) {
    const red = data[index] ?? 0;
    const green = channels > 1 ? (data[index + 1] ?? red) : red;
    const blue = channels > 2 ? (data[index + 2] ?? red) : red;
    const luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

    lumaBins[Math.min(BIN_COUNT - 1, Math.floor((luma / 256) * BIN_COUNT))] += 1;
    redBins[Math.min(BIN_COUNT - 1, Math.floor((red / 256) * BIN_COUNT))] += 1;
    greenBins[Math.min(BIN_COUNT - 1, Math.floor((green / 256) * BIN_COUNT))] += 1;
    blueBins[Math.min(BIN_COUNT - 1, Math.floor((blue / 256) * BIN_COUNT))] += 1;
  }

  return {
    analysisSize: {
      height: info.height,
      width: info.width,
    },
    binCount: BIN_COUNT,
    bins: {
      blue: normalizeBins(blueBins),
      green: normalizeBins(greenBins),
      luma: normalizeBins(lumaBins),
      red: normalizeBins(redBins),
    },
    sourceSize: {
      height: sourceHeight,
      width: sourceWidth,
    },
  };
}

function normalizeBins(values: number[]) {
  const peak = Math.max(...values, 1);
  return values.map((value) => value / peak);
}
