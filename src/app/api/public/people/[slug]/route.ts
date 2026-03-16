import { getPublicPersonBySlug } from "@/lib/portfolio";

export const revalidate = 300;
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const person = await getPublicPersonBySlug(slug);

  if (!person) {
    return Response.json({ error: "Person not found." }, { status: 404 });
  }

  return Response.json(person);
}
