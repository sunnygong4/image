import { fetchImmichThumbnail } from "@/lib/immich";
import { getPublicAssetById } from "@/lib/portfolio";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await params;
  const asset = await getPublicAssetById(assetId);

  if (!asset) {
    return new Response("Not found", { status: 404 });
  }

  const sizeParam = new URL(request.url).searchParams.get("size");
  const size =
    sizeParam === "thumbnail" || sizeParam === "fullsize" ? sizeParam : "preview";
  const response = await fetchImmichThumbnail(assetId, size);

  return new Response(response.body, {
    status: 200,
    headers: buildImageHeaders(response.headers),
  });
}

function buildImageHeaders(source: Headers) {
  const headers = new Headers();
  headers.set("Cache-Control", "public, max-age=300, s-maxage=300");

  const contentType = source.get("Content-Type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  const contentLength = source.get("Content-Length");
  if (contentLength) {
    headers.set("Content-Length", contentLength);
  }

  return headers;
}

