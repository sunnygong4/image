import { searchPublicAssets } from "@/lib/portfolio";

export const revalidate = 60;
export const runtime = "nodejs";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const results = await searchPublicAssets(query);
  return Response.json(results);
}

