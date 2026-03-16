import { getPerson, mergePeople } from "@/lib/db";
import { revalidatePortfolioPaths } from "@/lib/revalidate";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ personId: string }> },
) {
  const { personId } = await params;
  const existing = getPerson(personId);

  if (!existing) {
    return Response.json({ error: "Person not found." }, { status: 404 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const targetPersonId =
      typeof body.targetPersonId === "string" && body.targetPersonId.trim()
        ? body.targetPersonId.trim()
        : "";

    if (!targetPersonId) {
      throw new Error("targetPersonId is required.");
    }

    if (!getPerson(targetPersonId)) {
      return Response.json({ error: "Merge target not found." }, { status: 404 });
    }

    const merged = mergePeople(personId, targetPersonId);
    revalidatePortfolioPaths();

    return Response.json({ ok: true, person: merged });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Person merge failed unexpectedly.",
      },
      { status: 400 },
    );
  }
}
