import { getPublicAlbumBySlug } from "@/lib/portfolio";

export const revalidate = 300;
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const album = await getPublicAlbumBySlug(slug);

  if (!album) {
    return Response.json({ error: "Album not found." }, { status: 404 });
  }

  return Response.json(album);
}

