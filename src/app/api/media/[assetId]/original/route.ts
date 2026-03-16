import { fetchImmichOriginal } from "@/lib/immich";
import { getPublicAssetById } from "@/lib/portfolio";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await params;
  const asset = await getPublicAssetById(assetId);

  if (!asset || !asset.allowDownload) {
    return new Response("Not found", { status: 404 });
  }

  const response = await fetchImmichOriginal(assetId);
  const headers = new Headers();
  headers.set("Cache-Control", "private, max-age=300");
  headers.set(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(asset.originalFileName)}`,
  );

  const contentType = response.headers.get("Content-Type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  return new Response(response.body, {
    status: 200,
    headers,
  });
}

