import { getPublicAlbums } from "@/lib/portfolio";

export const revalidate = 300;
export const runtime = "nodejs";

export async function GET() {
  const albums = await getPublicAlbums();
  return Response.json(albums);
}

