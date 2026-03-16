import { isPortfolioGenre } from "@/lib/catalog";
import { getPublicAssetsByGenre } from "@/lib/portfolio";

export const revalidate = 300;
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ genre: string }> },
) {
  const { genre } = await params;

  if (!isPortfolioGenre(genre)) {
    return Response.json({ error: "Genre not found." }, { status: 404 });
  }

  const assets = await getPublicAssetsByGenre(genre);
  return Response.json(assets);
}
