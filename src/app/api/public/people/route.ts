import { getPublicPeople } from "@/lib/portfolio";

export const revalidate = 300;
export const runtime = "nodejs";

export async function GET() {
  const people = await getPublicPeople();
  return Response.json(people);
}
