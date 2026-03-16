import { getPerson, updatePerson } from "@/lib/db";
import { revalidatePortfolioPaths } from "@/lib/revalidate";
import { slugify } from "@/lib/slug";
import type { PersonVisibility } from "@/lib/types";

export const runtime = "nodejs";

export async function PATCH(
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
    const updated = updatePerson(personId, {
      confidenceScore: normalizeNullableNumber(body.confidenceScore),
      displayName:
        typeof body.displayName === "string" && body.displayName.trim()
          ? body.displayName.trim()
          : existing.displayName,
      slug:
        typeof body.slug === "string" && body.slug.trim()
          ? slugify(body.slug)
          : existing.slug,
      sourcePriority: normalizeInteger(body.sourcePriority, existing.sourcePriority),
      visibility: normalizeVisibility(body.visibility),
    });

    revalidatePortfolioPaths();
    return Response.json({ ok: true, person: updated });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Person update failed unexpectedly.",
      },
      { status: 400 },
    );
  }
}

function normalizeVisibility(value: unknown): PersonVisibility {
  if (value === "public" || value === "private" || value === "hidden") {
    return value;
  }

  throw new Error("Visibility must be public, private, or hidden.");
}

function normalizeInteger(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  return fallback;
}

function normalizeNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
