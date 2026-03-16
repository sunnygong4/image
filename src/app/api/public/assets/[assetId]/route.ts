import { getPublicAssetById } from "@/lib/portfolio";

export const revalidate = 300;
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await params;
  const asset = await getPublicAssetById(assetId);

  if (!asset) {
    return Response.json({ error: "Asset not found." }, { status: 404 });
  }

  return Response.json(asset);
}

